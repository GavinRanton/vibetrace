import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const execAsync = promisify(exec);

export interface SemgrepFinding {
  check_id: string;
  path: string;
  start: { line: number; col: number };
  end: { line: number; col: number };
  extra: {
    message: string;
    severity: string;
    metadata: Record<string, any>;
    lines: string;
  };
}

export interface ScanResult {
  findings: SemgrepFinding[];
  errors: string[];
  duration: number;
}

// Path to custom VibeTrace rules (hardcoded secrets, weak crypto, etc.)
const CUSTOM_RULES_PATH = path.join(process.cwd(), "semgrep-rules");


// VT-FIX-6: Filter findings where a hardcoded-secret rule matched an empty string literal
function filterEmptyStringSecrets(findings: SemgrepFinding[]): SemgrepFinding[] {
  const EMPTY_STRING_RE = /=\s*['"][\s]*['"]|:\s*['"][\s]*['"]/;
  const SECRET_RULE_RE = /(hardcoded|password|secret)/i;
  let suppressed = 0;
  const kept = findings.filter((f) => {
    if (!SECRET_RULE_RE.test(f.check_id)) return true;
    const lines = f.extra.lines ?? '';
    if (EMPTY_STRING_RE.test(lines)) {
      suppressed++;
      return false;
    }
    return true;
  });
  if (suppressed > 0) {
    console.log('[semgrep] Suppressed ' + suppressed + ' empty-string secret findings');
  }
  return kept;
}

// FP-FIX: Detect frameworks present in the codebase based on findings context
function detectFramework(findings: SemgrepFinding[]): string[] {
  const frameworks: string[] = [];
  for (const f of findings) {
    if (f.path.includes('manage.py') || f.extra?.lines?.includes('django')) frameworks.push('django');
    if (f.extra?.lines?.includes('from flask') || f.extra?.lines?.includes('import flask')) frameworks.push('flask');
    if (f.path.includes('next.config') || f.extra?.lines?.includes('next/')) frameworks.push('nextjs');
  }
  return [...new Set(frameworks)];
}

// FP-FIX: Filter SAST false positives (parameterised SQL, Django CSRF on Flask, localhost SSRF, exception logging, guarded redirects)
function filterSastFalsePositives(findings: SemgrepFinding[]): SemgrepFinding[] {
  const detectedFrameworks = detectFramework(findings);
  let suppressed = 0;
  const kept = findings.filter(f => {
    const ruleId = f.check_id.toLowerCase();
    const lines = f.extra?.lines ?? '';

    // FP-FIX-2: SQLAlchemy/psycopg2 — parameterised execute() is not injectable
    if (ruleId.includes('sql') && ruleId.includes('inject')) {
      // .execute(sql, params) or .execute(query, values) — second arg = parameterised
      if (/\.execute\s*\([^,]+,\s*[\w\[\(]/.test(lines)) {
        console.log(`[semgrep] Suppressing SQL injection FP (parameterised execute): ${f.check_id}`);
        suppressed++;
        return false;
      }
    }

    // FP-FIX-3: Django CSRF rule on Flask apps — check for Flask imports in file
    if (ruleId.includes('django') && ruleId.includes('csrf')) {
      // If no Django imports detected in the same finding context, suppress
      if (!lines.includes('django') && !lines.includes('Django')) {
        console.log(`[semgrep] Suppressing Django CSRF FP on non-Django file: ${f.check_id} @ ${f.path}`);
        suppressed++;
        return false;
      }
    }

    // FP-FIX-3b: Django rules on non-Django codebases
    if (ruleId.includes('django') && !detectedFrameworks.includes('django')) {
      if (detectedFrameworks.includes('flask') || detectedFrameworks.includes('nextjs')) {
        console.log(`[semgrep] Suppressing Django rule on non-Django codebase: ${f.check_id} @ ${f.path}`);
        suppressed++;
        return false;
      }
    }

    // FP-FIX-4: SSRF — localhost/internal URLs are not external SSRF
    if (ruleId.includes('ssrf')) {
      if (/https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)(:\d+)?/.test(lines)) {
        console.log(`[semgrep] Suppressing SSRF FP (localhost URL): ${f.check_id}`);
        suppressed++;
        return false;
      }
    }

    // FP-FIX-5: Exception/error logging ≠ credential leak
    // Pattern: logger.error("...", exception) or logger.error("failed: %s", e)
    if (ruleId.includes('secret') || ruleId.includes('credential') || ruleId.includes('log')) {
      // logger calls with exception/error objects are standard — not credential leaks
      if (/logger?\.\w+\s*\([^)]*,\s*(e|err|error|exception|ex)\b/.test(lines) ||
          /console\.(error|warn|log)\s*\([^)]*,\s*(e|err|error|exception|ex)\b/.test(lines)) {
        console.log(`[semgrep] Suppressing exception-logging FP: ${f.check_id}`);
        suppressed++;
        return false;
      }
    }

    // FP-FIX-6: Open redirect — suppress if a safe redirect guard function is called nearby
    if (ruleId.includes('redirect') || ruleId.includes('open-redirect')) {
      const SAFE_GUARD_PATTERN = /(_safe_redirect|safe_redirect|validate_redirect|is_safe_url|sanitize_redirect|allowed_redirect)/i;
      if (SAFE_GUARD_PATTERN.test(lines)) {
        console.log(`[semgrep] Suppressing open redirect FP (guard function present): ${f.check_id}`);
        suppressed++;
        return false;
      }
    }

    // FP-FIX-9: Insecure HTTP on localhost/127.0.0.1 — internal loopback, HTTPS not applicable
    if (ruleId.includes('insecure-request') || ruleId.includes('insecure-url') || ruleId.includes('http-not-https')) {
      if (/https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(lines)) {
        console.log(`[semgrep] Suppressing localhost HTTP FP: ${f.check_id}`);
        suppressed++;
        return false;
      }
    }

    return true;
  });

  if (suppressed > 0) {
    console.log(`[semgrep] Total false positive filters suppressed: ${suppressed}`);
  }
  return kept;
}

export async function runSemgrepScan(repoPath: string): Promise<ScanResult> {
  const startTime = Date.now();
  const outputFile = path.join(os.tmpdir(), `semgrep-${Date.now()}.json`);

  try {
    // Use --config auto for broad community coverage (catches eval, command injection, XSS, SQL)
    // Plus our custom rules for vibe-coded app patterns (hardcoded secrets, weak crypto)
    const semgrepBin = process.env.SEMGREP_PATH || 'semgrep';
    const cmd = `${semgrepBin} scan --config auto --config ${CUSTOM_RULES_PATH} --json --output ${outputFile} --timeout 120 ${repoPath}`;

    const semgrepDir = process.env.SEMGREP_PATH ? path.dirname(process.env.SEMGREP_PATH) : '';
    const envPath = `${semgrepDir}${semgrepDir ? ':' : ''}/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`;
    await execAsync(
      cmd,
      { timeout: 180000, maxBuffer: 50 * 1024 * 1024, env: { ...process.env, PATH: envPath } }
    );

    const raw = await fs.readFile(outputFile, "utf-8");
    const parsed = JSON.parse(raw);

    return {
      findings: filterSastFalsePositives(filterEmptyStringSecrets(parsed.results || [])),
      errors: (parsed.errors || []).map((e: any) => e.message || String(e)),
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    // Semgrep exits with code 1 when findings exist — still valid
    if (error.code === 1) {
      try {
        const raw = await fs.readFile(outputFile, "utf-8");
        const parsed = JSON.parse(raw);
        return {
          findings: filterSastFalsePositives(filterEmptyStringSecrets(parsed.results || [])),
          errors: [],
          duration: Date.now() - startTime,
        };
      } catch {}
    }
    
    return {
      findings: [],
      errors: [error.message || "Scan failed"],
      duration: Date.now() - startTime,
    };
  } finally {
    await fs.unlink(outputFile).catch(() => {});
  }
}

export async function cloneRepo(
  repoFullName: string,
  githubToken: string
): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), `vibetrace-scan-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  const cloneUrl = `https://x-access-token:${githubToken}@github.com/${repoFullName}.git`;
  
  await execAsync(`git clone --depth 1 ${cloneUrl} ${tmpDir}`, {
    timeout: 60000,
  });

  return tmpDir;
}

export async function cleanupRepo(repoPath: string): Promise<void> {
  await fs.rm(repoPath, { recursive: true, force: true });
}

export function mapSeverity(semgrepSeverity: string): string {
  switch (semgrepSeverity.toUpperCase()) {
    case "ERROR": return "critical";
    case "WARNING": return "high";
    case "INFO": return "medium";
    default: return "low";
  }
}

export function categoriseFinding(checkId: string): string {
  if (checkId.includes("secret") || checkId.includes("hardcoded") || checkId.includes("password")) return "hardcoded-secrets";
  if (checkId.includes("sql") || checkId.includes("injection")) return "sql-injection";
  if (checkId.includes("xss") || checkId.includes("cross-site")) return "xss";
  if (checkId.includes("auth") || checkId.includes("session")) return "missing-auth";
  if (checkId.includes("idor") || checkId.includes("object-reference")) return "idor";
  if (checkId.includes("crypto") || checkId.includes("encrypt")) return "insecure-crypto";
  if (checkId.includes("eval") || checkId.includes("dangerous")) return "dangerous-functions";
  if (checkId.includes("supabase") || checkId.includes("firebase")) return "exposed-credentials";
  if (checkId.includes("input") || checkId.includes("valid")) return "missing-validation";
  return "other";
}
