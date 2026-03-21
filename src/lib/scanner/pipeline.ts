import * as fs from "fs/promises";
import { adminClient } from "@/lib/supabase-admin";
import { cloneRepo, runSemgrepScan, cleanupRepo, mapSeverity, categoriseFinding } from "@/lib/scanner/semgrep";
import { runSeoScan } from "@/lib/scanner/seo";
import { translateFindings } from "@/lib/scanner/translate";
import { calculateScore } from "@/lib/scanner/score";
import { sendScanCompleteEmail } from "@/lib/email";
import { runZapScan, truncateSnippet } from "@/lib/scanner/zap";

// VT-FIX-7: Non-production path patterns — findings in these paths get severity downgraded
const NON_PRODUCTION_PATH_PATTERNS = [
  // Test/spec directories
  /(^|\/)(__tests?__|tests?|spec|specs|e2e|cypress|playwright)\//i,
  /(^|\/)(fixtures?|mocks?|stubs?|fakes?)\//i,
  /(^|\/)stories?\//i,
  /\.stories\.[jt]sx?$/i,
  /\.test\.[jt]sx?$/i,
  /\.spec\.[jt]sx?$/i,
  /(^|\/)(dev|development|sandbox|demo|example|examples)\//i,
  // VT-FIX-7: Non-production paths — scripts, migration tools, archive code
  // Note: paths are relative (no leading /), so patterns must not require leading slash
  /(^|\/)scripts\//i,
  /(^|\/)whisky-import\//i,
  /(^|\/)archive\//i,
  /seed[\w-]*\.[jt]s/i,
  // VT-FIX-7c: UI components and AI utility files — Math.random() is for animations/jitter
  /(^|\/)src\/components\//i,
  /(^|\/)lib\/(embeddings|openai|intent|ai|llm|vector|search)[\w-]*\.[jt]sx?$/i,
  // VT-FIX-8: Admin, migrate, and config files — reduced attack surface
  /(^|\/)src\/app\/api\/admin\//i,
  /\/migrate\/route\.[jt]sx?$/i,
  /(^|\/)nginx\//i,
];

function isNonProductionPath(filePath: string): boolean {
  return NON_PRODUCTION_PATH_PATTERNS.some((re) => re.test(filePath));
}

function downgradeSeverity(severity: string): string {
  const order = ['critical', 'high', 'medium', 'low', 'info'];
  const idx = order.indexOf(severity);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : severity;
}

async function buildSemgrepSnippet(
  repoPath: string,
  filePath: string,
  startLine: number,
  endLine: number,
  semgrepLines: string | null | undefined
): Promise<string | null> {
  const primary = truncateSnippet(semgrepLines);
  if (primary) return primary;

  if (!filePath) return null;

  const start = Math.max(1, startLine - 2);
  const end = Math.max(start, endLine + 2);
  const absolutePath = `${repoPath}/${filePath}`;

  try {
    const fileRaw = await fs.readFile(absolutePath, "utf-8");
    const fileLines = fileRaw.split(/\r?\n/);
    const snippet = fileLines.slice(start - 1, end).join("\n");
    return truncateSnippet(snippet);
  } catch (err: any) {
    console.warn(`[SEMGREP] Snippet fallback failed for ${filePath}: ${err.message}`);
    return null;
  }
}

export async function processScan(
  scanId: string,
  repoFullName: string | null,
  githubToken: string | null,
  userId: string,
  repoIdUuid: string | null,
  deployedUrl?: string
) {
  let repoPath: string | null = null;
  const mappedFindings: any[] = [];

  try {
    if (repoIdUuid && repoFullName && githubToken) {
      // Clone repo
      await adminClient.from("scans").update({ status: "cloning" }).eq("id", scanId);
      repoPath = await cloneRepo(repoFullName, githubToken);

      // Run Semgrep
      await adminClient.from("scans").update({ status: "scanning" }).eq("id", scanId);
      console.log('[SEMGREP] starting scan on', repoPath);
      const scanResult = await runSemgrepScan(repoPath);

      // Translate findings with Gemini
      await adminClient.from("scans").update({ status: "translating" }).eq("id", scanId);
      const translations = await translateFindings(scanResult.findings);

      // Map and insert findings
      const semgrepFindings: any[] = [];
      for (const f of scanResult.findings) {
        const key = `${f.path}:${f.start.line}:${f.check_id}`;
        const translation = translations.get(key);
        const baseSeverity = mapSeverity(f.extra.severity);
        // Strip /tmp/vibetrace-scan-XXXX/ prefix so users see clean relative paths
        const cleanPath = repoPath ? f.path.replace(repoPath + "/", "") : f.path;
        // VT-FIX-7: Downgrade severity for non-production paths
        const nonProd = isNonProductionPath(cleanPath);
        // VT-FIX-8: Triple-downgrade non-prod paths (HIGH->INFO via 3 steps) — no live attack surface
        const severity = nonProd ? downgradeSeverity(downgradeSeverity(downgradeSeverity(baseSeverity))) : baseSeverity;
        if (nonProd) console.log(`[semgrep] Non-prod path severity downgraded: ${cleanPath} ${baseSeverity} -> ${severity}`);
        console.log("[SEMGREP] extra.lines before insert:", f.extra.lines);
        const snippet = repoPath
          ? await buildSemgrepSnippet(repoPath, cleanPath, f.start.line, f.end.line, f.extra.lines)
          : truncateSnippet(f.extra.lines);

        semgrepFindings.push({
          scan_id: scanId,
          severity,
          category: categoriseFinding(f.check_id),
          rule_id: f.check_id,
          file_path: cleanPath,
          line_number: f.start.line,
          code_snippet: snippet ?? (cleanPath ? "Code context unavailable" : null),
          raw_output: f,
          plain_english: translation?.plain_english || f.extra.message,
          business_impact: translation?.business_impact || `${severity} severity finding`,
          fix_prompt: translation?.fix_prompt || `Fix the issue in ${cleanPath} at line ${f.start.line}`,
          verification_step: translation?.verification_step || "Re-run the scan to verify the fix",
          status: "open",
        });
      }

      const dedupedSast = new Map<string, (typeof semgrepFindings)[number]>();
      for (const finding of semgrepFindings) {
        const dedupeKey = `${finding.rule_id}::${finding.file_path}`;
        if (!dedupedSast.has(dedupeKey)) dedupedSast.set(dedupeKey, finding);
      }
      const finalSastFindings = Array.from(dedupedSast.values());

      if (finalSastFindings.length > 0) {
        await adminClient.from("findings").insert(finalSastFindings);
      }

      mappedFindings.push(...finalSastFindings);
    } else {
      // URL-only scan — go straight to DAST
      await adminClient.from("scans").update({ status: "scanning" }).eq("id", scanId);
    }

    // Run ZAP DAST scan if a deployed URL was provided
    if (deployedUrl) {
      await adminClient.from("scans").update({ status: "scanning", zap_included: true }).eq("id", scanId);
      await runZapScan(deployedUrl, scanId);
    }

    // Run SEO scan if a deployed URL was provided
    if (deployedUrl) {
      try {
        console.log("[SEO] Starting SEO scan for:", deployedUrl);
        const seoFindings = await runSeoScan(deployedUrl, scanId);
        if (seoFindings.length > 0) {
          const seoRows = seoFindings.map(f => ({
            scan_id: scanId,
            severity: f.severity,
            category: "seo",
            rule_id: f.rule_id,
            file_path: f.file_path,
            line_number: null,
            code_snippet: null,
            raw_output: null,
            plain_english: f.plain_english,
            business_impact: f.business_impact,
            fix_prompt: f.fix_prompt,
            verification_step: f.verification_step,
            status: "open",
          }));
          const { error: seoErr } = await adminClient.from("findings").insert(seoRows);
          if (seoErr) console.error("[SEO] Failed to insert SEO findings:", seoErr);
          else console.log(`[SEO] Saved ${seoRows.length} SEO findings for scan ${scanId}`);
        }
      } catch (seoErr: any) {
        console.error("[SEO] SEO scan failed:", seoErr.message);
      }
    }

    // Fetch ALL findings for this scan (SAST + DAST + SEO) for accurate score
    const { data: allFindings } = await adminClient
      .from("findings")
      .select("severity, category")
      .eq("scan_id", scanId);
    const allF = allFindings ?? mappedFindings;

    // Calculate score and update scan
    const score = calculateScore(allF);
    const counts = {
      critical: allF.filter((f: any) => f.severity === "critical").length,
      high: allF.filter((f: any) => f.severity === "high").length,
      medium: allF.filter((f: any) => f.severity === "medium").length,
      low: allF.filter((f: any) => f.severity === "low").length,
    };

    await adminClient.from("scans").update({
      status: "complete",
      score,
      total_findings: allF.length,
      critical_count: counts.critical,
      high_count: counts.high,
      medium_count: counts.medium,
      low_count: counts.low,
      completed_at: new Date().toISOString(),
    }).eq("id", scanId);

    // Update user scan count — count completed scans for this user
    const { count: scanCountResult } = await adminClient
      .from("scans")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "complete");

    await adminClient
      .from("users")
      .update({ scan_count: scanCountResult ?? 0 })
      .eq("id", userId);

    // Update repo last scanned (only when a repo is involved)
    if (repoIdUuid) {
      await adminClient.from("repos").update({ last_scanned_at: new Date().toISOString() }).eq("id", repoIdUuid);
    }

    // Send email notification to user
    try {
      const { data: userRecord } = await adminClient
        .from("users")
        .select("email")
        .eq("id", userId)
        .single();
      if (userRecord?.email) {
        await sendScanCompleteEmail(userRecord.email, {
          scan_id: scanId,
          repo_name: repoFullName ?? deployedUrl ?? "URL scan",
          score,
          total_findings: allF.length,
          critical_count: counts.critical,
          high_count: counts.high,
          medium_count: counts.medium,
          low_count: counts.low,
          completed_at: new Date().toISOString(),
        });
        console.log("[VibeTrace] Scan complete email sent to:", userRecord.email);
      }
    } catch (emailErr) {
      console.error("[VibeTrace] Email notification failed:", emailErr);
    }

  } catch (error: any) {
    console.error("Scan processing error:", error);
    await adminClient.from("scans").update({
      status: "failed",
      error_message: error.message,
      completed_at: new Date().toISOString(),
    }).eq("id", scanId);
  } finally {
    // CRITICAL: Always cleanup cloned repo
    if (repoPath) {
      await cleanupRepo(repoPath);
      console.log(`[VibeTrace] Repo cleaned up: ${repoPath}`);
    }
  }
}
