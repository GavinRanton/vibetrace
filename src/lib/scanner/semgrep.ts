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

export async function runSemgrepScan(repoPath: string): Promise<ScanResult> {
  const startTime = Date.now();
  const outputFile = path.join(os.tmpdir(), `semgrep-${Date.now()}.json`);

  try {
    // Use --config auto for broad community coverage (catches eval, command injection, XSS, SQL)
    // Plus our custom rules for vibe-coded app patterns (hardcoded secrets, weak crypto)
    const cmd = `semgrep scan --config auto --config ${CUSTOM_RULES_PATH} --json --output ${outputFile} --timeout 120 ${repoPath}`;
    
    await execAsync(
      cmd,
      { timeout: 180000, maxBuffer: 50 * 1024 * 1024 }
    );

    const raw = await fs.readFile(outputFile, "utf-8");
    const parsed = JSON.parse(raw);

    return {
      findings: parsed.results || [],
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
          findings: parsed.results || [],
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
