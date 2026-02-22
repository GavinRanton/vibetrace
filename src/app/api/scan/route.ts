import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import { cloneRepo, runSemgrepScan, cleanupRepo, mapSeverity, categoriseFinding } from "@/lib/scanner/semgrep";
import { translateFindings, calculateScore } from "@/lib/scanner/translate";
import { sendScanCompleteEmail } from "@/lib/email";

const execAsync = promisify(execCb);

// Admin client for writing scan results (bypasses RLS)
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function isPrivateUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      /^fc00:/i.test(hostname) ||
      /^fe80:/i.test(hostname)
    );
  } catch {
    return true; // invalid URL treated as private/unsafe
  }
}

async function runZapScan(url: string, scanId: string): Promise<number> {
  try {
    if (isPrivateUrl(url)) {
      console.warn(`[ZAP] Skipping scan — private/internal URL rejected: ${url}`);
      return 0;
    }

    const zapWorkDir = "/tmp/zap";
    const resultsPath = `${zapWorkDir}/results.json`;

    // Ensure work dir exists
    try {
      await fs.mkdir(zapWorkDir, { recursive: true });
    } catch {}

    // Remove stale results file
    try {
      await fs.unlink(resultsPath);
    } catch {}

    const dockerCmd = `docker run --rm -v /tmp/zap:/zap/wrk:rw ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t ${url} -J /zap/wrk/results.json -I`;

    console.log(`[ZAP] Starting baseline scan for: ${url}`);

    try {
      await Promise.race([
        execAsync(dockerCmd),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("ZAP scan timed out after 120s")), 120_000)
        ),
      ]);
    } catch (err: any) {
      if (err.message?.includes("timed out")) {
        console.warn(`[ZAP] Timeout reached — attempting to read partial results`);
      } else {
        // ZAP exits non-zero even on success (when alerts found) — log but continue
        console.warn(`[ZAP] Docker exited with error (may be normal): ${err.message}`);
      }
    }

    // Parse results
    let raw: string;
    try {
      raw = await fs.readFile(resultsPath, "utf-8");
    } catch {
      console.warn("[ZAP] No results file found — scan may have failed entirely");
      return 0;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      console.warn("[ZAP] Could not parse results.json");
      return 0;
    }

    const sites: any[] = parsed?.site ?? [];
    const alerts: any[] = sites[0]?.alerts ?? [];

    if (alerts.length === 0) {
      console.log("[ZAP] No alerts found");
      return 0;
    }

    const riskMap: Record<string, string> = {
      "3": "critical",
      "2": "high",
      "1": "medium",
      "0": "low",
    };

    const findings = alerts.map((alert: any) => ({
      scan_id: scanId,
      severity: riskMap[String(alert.riskcode)] ?? "low",
      category: "dast",
      rule_id: alert.pluginid ? `zap-${alert.pluginid}` : "zap-unknown",
      file_path: url,
      line_number: null,
      code_snippet: alert.evidence || null,
      raw_output: alert,
      plain_english: alert.desc || alert.name || "Security issue detected by DAST scan",
      business_impact: `${riskMap[String(alert.riskcode)] ?? "low"} severity DAST finding: ${alert.name ?? "Unknown"}`,
      fix_prompt: alert.solution || `Remediate the ${alert.name ?? "security"} issue found at ${url}`,
      verification_step: "Re-run the DAST scan against the deployed URL to verify the fix",
      status: "open",
    }));

    if (findings.length > 0) {
      const { error } = await adminClient.from("findings").insert(findings);
      if (error) {
        console.error("[ZAP] Failed to insert findings:", error);
        return 0;
      }
    }

    console.log(`[ZAP] Saved ${findings.length} DAST findings for scan ${scanId}`);
    return findings.length;
  } catch (err: any) {
    console.error("[ZAP] runZapScan failed unexpectedly:", err.message);
    return 0;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));

    const body = await request.json();
    const { repo_id, repo_full_name, deployed_url } = body;

    if (!repo_id && !deployed_url) {
      return NextResponse.json({ error: "Provide a repository or deployed URL" }, { status: 400 });
    }

    const githubToken = session?.provider_token ?? null;
    if (!githubToken && repo_id) {
      return NextResponse.json({ error: "No GitHub token — please re-authenticate" }, { status: 401 });
    }

    // Check plan limits
    const { data: userRecord } = await adminClient
      .from("users")
      .select("plan, scan_count")
      .eq("id", user.id)
      .single();

    if (userRecord?.plan === "free" && userRecord?.scan_count >= 1) {
      return NextResponse.json({ error: "Free plan limit reached. Upgrade to scan more." }, { status: 403 });
    }

    // Upsert repo record to get internal UUID (only when a repo is provided)
    let repoUuid: string | null = null;
    if (repo_id && repo_full_name) {
      const { data: repoRecord, error: repoError } = await adminClient
        .from("repos")
        .upsert({
          user_id: user.id,
          github_repo_id: String(repo_id),
          name: repo_full_name.split("/")[1],
          full_name: repo_full_name,
        }, { onConflict: "user_id,github_repo_id" })
        .select("id")
        .single();

      if (repoError || !repoRecord) {
        console.error("Failed to upsert repo:", repoError);
        return NextResponse.json({ error: "Failed to register repository" }, { status: 500 });
      }

      repoUuid = repoRecord.id;
    }

    // Create scan record using internal UUID (null for URL-only scans)
    const { data: scan, error: scanError } = await adminClient
      .from("scans")
      .insert({
        repo_id: repoUuid,
        user_id: user.id,
        status: "cloning",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (scanError || !scan) {
      console.error("Failed to create scan:", scanError);
      return NextResponse.json({ error: "Failed to create scan" }, { status: 500 });
    }

    // Run scan asynchronously (respond immediately, process in background)
    processScan(scan.id, repo_full_name ?? null, githubToken ?? null, user.id, repoUuid, deployed_url);

    return NextResponse.json({ scan_id: scan.id, status: "started" });
  } catch (error: any) {
    console.error("Scan error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function processScan(
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
      const scanResult = await runSemgrepScan(repoPath);

      // Translate findings with Claude
      await adminClient.from("scans").update({ status: "translating" }).eq("id", scanId);
      const translations = await translateFindings(
        scanResult.findings,
        process.env.ANTHROPIC_API_KEY || ""
      );

      // Map and insert findings
      const semgrepFindings = scanResult.findings.map((f) => {
        const key = `${f.path}:${f.start.line}:${f.check_id}`;
        const translation = translations.get(key);
        const severity = mapSeverity(f.extra.severity);

        return {
          scan_id: scanId,
          severity,
          category: categoriseFinding(f.check_id),
          rule_id: f.check_id,
          file_path: f.path,
          line_number: f.start.line,
          code_snippet: f.extra.lines,
          raw_output: f,
          plain_english: translation?.plain_english || f.extra.message,
          business_impact: translation?.business_impact || `${severity} severity finding`,
          fix_prompt: translation?.fix_prompt || `Fix the issue in ${f.path} at line ${f.start.line}`,
          verification_step: translation?.verification_step || "Re-run the scan to verify the fix",
          status: "open",
        };
      });

      if (semgrepFindings.length > 0) {
        await adminClient.from("findings").insert(semgrepFindings);
      }

      mappedFindings.push(...semgrepFindings);
    } else {
      // URL-only scan — go straight to DAST
      await adminClient.from("scans").update({ status: "scanning" }).eq("id", scanId);
    }

    // Run ZAP DAST scan if a deployed URL was provided
    if (deployedUrl) {
      await adminClient.from("scans").update({ status: "dast_scanning" }).eq("id", scanId);
      await runZapScan(deployedUrl, scanId);
    }

    // Calculate score and update scan
    const score = calculateScore(mappedFindings);
    const counts = {
      critical: mappedFindings.filter(f => f.severity === "critical").length,
      high: mappedFindings.filter(f => f.severity === "high").length,
      medium: mappedFindings.filter(f => f.severity === "medium").length,
      low: mappedFindings.filter(f => f.severity === "low").length,
    };

    await adminClient.from("scans").update({
      status: "complete",
      score,
      total_findings: mappedFindings.length,
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
          total_findings: mappedFindings.length,
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
