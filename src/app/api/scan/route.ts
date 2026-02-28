import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, after } from "next/server";
import type { NextRequest } from "next/server";
import { exec as execCb } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import { cloneRepo, runSemgrepScan, cleanupRepo, mapSeverity, categoriseFinding } from "@/lib/scanner/semgrep";
import { runSeoScan } from "@/lib/scanner/seo";
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

const MAX_SNIPPET_CHARS = 500;
const ZAP_SUPPRESSED_RULES = new Set(["zap-10109"]);
const CACHE_RULE_HINT = /(cache|pragma|expires|cache-control)/i;
const HTML_COMMENT_HINT = /(html\s*comment|information leakage - comments|comments?\sin)/i;
const CSP_HINT = /(content-security-policy|\bcsp\b)/i;
const COEP_HINT = /(cross-origin-embedder-policy|\bcoep\b|require-corp)/i;
const ERROR_PAGE_HINT = /(error\s*page|stack\s*trace|exception\s*handling)/i;

function truncateSnippet(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_SNIPPET_CHARS
    ? `${trimmed.slice(0, MAX_SNIPPET_CHARS)}...`
    : trimmed;
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

function severityScore(severity: string): number {
  const severityRank: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
    info: 0,
  };
  return severityRank[severity] ?? 0;
}

function enforceLovablePromptRules(
  finding: { name: string; desc: string; severity: string },
  fixPrompt: string | null | undefined,
  isHtmlCommentFinding: boolean
): { severity: string; fixPrompt: string | null } {
  if (isHtmlCommentFinding) {
    return { severity: "info", fixPrompt: null };
  }

  if (!fixPrompt) {
    return { severity: finding.severity, fixPrompt: null };
  }

  let normalized = fixPrompt;

  if (CSP_HINT.test(`${finding.name} ${finding.desc}`) && /nonce/i.test(normalized)) {
    normalized =
      'In Lovable (or Cursor), paste this exactly:\n"I need to fix my Content-Security-Policy safely for a Lovable app. Do not use CSP nonces. Keep inline scripts working, and instead add a strict domain allowlist in my CSP headers for only trusted domains (including the exact third-party domains my app already uses). Please generate the exact Next.js header config and apply it in a secure way."';
  }

  if (COEP_HINT.test(`${finding.name} ${finding.desc}`) && !/test in staging/i.test(normalized)) {
    normalized = `${normalized}\n\nNote: this may break third-party embeds. Test in staging first.`;
  }

  if (ERROR_PAGE_HINT.test(`${finding.name} ${finding.desc}`)) {
    normalized = normalized.replace(/pages\/_error\.(js|tsx?)/gi, "app/error.tsx");
  }

  return { severity: finding.severity, fixPrompt: normalized };
}

async function runZapScan(url: string, scanId: string): Promise<number> {
  try {
    if (isPrivateUrl(url)) {
      // Treat as a hard failure so we don't show a misleading 100/100 for a scan we refused to run.
      throw new Error(`ZAP refused to scan private/internal URL: ${url}`);
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

    const dockerCmd = `docker run --rm -v /tmp/zap:/zap/wrk:rw ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t ${url} -J results.json -I`;

    console.log(`[ZAP] Starting baseline scan for: ${url}`);

    try {
      await Promise.race([
        execAsync(dockerCmd),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("ZAP scan timed out after 300s")), 300_000)
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
      // Hard fail: otherwise we mark the scan complete with 0 findings + score 100, which is misleading.
      throw new Error("ZAP did not produce results.json (scan failed, timed out, or was blocked)");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("ZAP produced an unreadable results.json (JSON parse failed)");
    }

    const sites: any[] = parsed?.site ?? [];
    if (sites.length === 0) {
      throw new Error("ZAP results.json contained no site data (scan likely failed)");
    }
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

    // Strip HTML tags from ZAP text fields
    function stripHtml(html: string): string {
      return (html || "").replace(/<[^>]+>/g, "").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&amp;/g,"&").replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim();
    }

    // Build base findings
    const baseFindings = alerts.map((alert: any) => ({
      severity: riskMap[String(alert.riskcode)] ?? "low",
      name: alert.name ?? "Unknown",
      desc: stripHtml(alert.desc || alert.name || ""),
      solution: stripHtml(alert.solution || ""),
      evidence: alert.evidence || null,
      pluginid: alert.pluginid,
      rule_id: alert.pluginid ? `zap-${alert.pluginid}` : "zap-unknown",
    }));

    // Translate via Gemini for Lovable/Cursor format prompts
    let translations: Map<string, any> = new Map();
    try {
      const vaultRes = await fetch("http://127.0.0.1:8443/secrets/vibetrace/GEMINI_API_KEY", {
        headers: { Authorization: "Bearer f4e28f48a1944aec09e7141ecb980ff518d06b53f2ed9897981ee9a5776ade40" },
      }).catch(() => null);
      const vaultData = vaultRes?.ok ? await vaultRes.json() : null;
      const geminiKey = vaultData?.value ?? process.env.GEMINI_API_KEY;

      if (geminiKey) {
        const dastPrompt = baseFindings.map((f, i) => `Finding ${i + 1}: ${f.name}\nRule ID: ${f.rule_id}\nSeverity: ${f.severity}\nWhat ZAP found: ${f.desc}\nZAP fix: ${f.solution}`).join("\n---\n");
        const systemPrompt = `You are a security expert translating DAST (live site) security findings for non-technical founders using Lovable, Bolt.new, or Cursor to build their apps.

IMPORTANT CONTEXT: Users are non-technical founders who built their app using Lovable, Bolt.new, or Cursor.

For each finding, write:
1. plain_english: 1-2 sentence plain explanation using an analogy. No jargon.
2. business_impact: What could actually go wrong. Be specific to the risk level.
3. fix_prompt: A complete prompt to paste into Lovable/Cursor. Must start with "In Lovable (or Cursor), paste this exactly:\n\"". Reference the specific header or setting to add. For web frameworks (Next.js, Express, etc), give the specific middleware/config code pattern to add. Never mention server config files.
4. verification_step: Simple check — usually "Visit your site in a browser and check the Network tab headers" or similar.

Rules for fix prompts:
1. Never recommend nonces for CSP. Lovable apps use inline scripts that cannot be safely nonced. Recommend allowlisting specific trusted domains instead.
2. Always use Next.js App Router syntax (app/error.tsx), never pages/_error.js.
3. For COEP (Cross-Origin-Embedder-Policy), include a warning that require-corp can break third-party embeds and should be tested in staging first.
4. For HTML comment findings, return severity "info" and leave fix_prompt empty.
5. For cache-related findings, merge related cache findings into one combined fix prompt.
6. The fix_prompt must be something a user can paste directly into Lovable or Cursor. If no concrete code/action exists, leave fix_prompt empty.

Respond with a JSON array only.`;

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 90000);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
          {
            method: "POST", signal: ctrl.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: "user", parts: [{ text: `Translate these ${baseFindings.length} DAST findings into non-technical Lovable/Cursor format:\n\n${dastPrompt}` }] }],
              generationConfig: { maxOutputTokens: 32768, temperature: 0.1, responseMimeType: "application/json" },
            }),
          }
        );
        clearTimeout(timer);
        if (res.ok) {
          const data = await res.json();
          const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
          try {
            // responseMimeType:application/json returns clean JSON directly
            const jsonStart = raw.indexOf("[");
            const jsonEnd = raw.lastIndexOf("]") + 1;
            const parsed = JSON.parse(jsonStart >= 0 ? raw.slice(jsonStart, jsonEnd) : raw);
            parsed.forEach((t: any, i: number) => translations.set(String(i), t));
          } catch (parseErr: any) {
            console.error("[ZAP] JSON parse error:", parseErr.message, "raw length:", raw.length);
          }
        }
      }
    } catch (e: any) {
      console.error("[ZAP] Gemini translation error:", e.message);
    }

    const translatedFindings = baseFindings.map((f, i) => {
      const t = translations.get(String(i));
      const isHtmlCommentFinding = HTML_COMMENT_HINT.test(f.name) || HTML_COMMENT_HINT.test(f.desc);
      const baseFixPrompt = t?.fix_prompt || f.solution || `Fix the ${f.name} issue on your live site`;
      const { severity: normalizedSeverity, fixPrompt } = enforceLovablePromptRules(
        f,
        baseFixPrompt,
        isHtmlCommentFinding
      );

      return {
        scan_id: scanId,
        severity: normalizedSeverity,
        category: "dast",
        rule_id: f.rule_id,
        file_path: url,
        line_number: null,
        code_snippet: truncateSnippet(f.evidence),
        raw_output: alerts[i],
        plain_english: t?.plain_english || f.desc,
        business_impact: t?.business_impact || `${normalizedSeverity} severity DAST finding: ${f.name}`,
        fix_prompt: fixPrompt,
        verification_step: t?.verification_step || "Re-run the DAST scan to verify the fix",
        status: "open",
      };
    });

    const filteredFindings = translatedFindings.filter((finding) => !ZAP_SUPPRESSED_RULES.has(finding.rule_id));

    // Merge noisy cache findings into one per scan/rule family before deduping by rule.
    const cacheBucket: typeof filteredFindings = [];
    const nonCacheFindings = filteredFindings.filter((finding) => {
      const isCache = CACHE_RULE_HINT.test(finding.rule_id) || CACHE_RULE_HINT.test(String(finding.raw_output?.name ?? ""));
      if (isCache) cacheBucket.push(finding);
      return !isCache;
    });

    if (cacheBucket.length > 0) {
      const mostSevere = cacheBucket.reduce((best, current) =>
        severityScore(current.severity) > severityScore(best.severity) ? current : best
      );
      nonCacheFindings.push({
        ...mostSevere,
        rule_id: "zap-cache-combined",
        plain_english: "Your site has inconsistent or missing cache protections that can expose sensitive responses.",
        business_impact:
          "Attackers or shared devices may view stale authenticated data when cache headers are not configured consistently.",
        fix_prompt:
          'In Lovable (or Cursor), paste this exactly:\n"I need one unified cache-security fix. Please set strict headers for sensitive pages and API responses: Cache-Control: no-store, no-cache, must-revalidate, Pragma: no-cache, and Expires: 0. Keep static asset caching intact, but prevent caching for authenticated or user-specific content. Apply this in my Next.js response/header configuration and show the exact code changes."',
      });
    }

    // Deduplicate by rule_id, keeping the highest-severity instance.
    const dedupedMap = new Map<string, (typeof nonCacheFindings)[number]>();
    for (const finding of nonCacheFindings) {
      const existing = dedupedMap.get(finding.rule_id);
      if (!existing || severityScore(finding.severity) > severityScore(existing.severity)) {
        dedupedMap.set(finding.rule_id, finding);
      }
    }
    const dedupedFindings = Array.from(dedupedMap.values());

    if (dedupedFindings.length > 0) {
      const { error } = await adminClient.from("findings").insert(dedupedFindings);
      if (error) {
        console.error("[ZAP] Failed to insert findings:", error);
        return 0;
      }
    }

    console.log(`[ZAP] Saved ${dedupedFindings.length} DAST findings for scan ${scanId}`);
    return dedupedFindings.length;
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
    const { repo_id, repo_full_name, deployed_url, github_token: bodyToken } = body;

    if (!repo_id && !deployed_url) {
      return NextResponse.json({ error: "Provide a repository or deployed URL" }, { status: 400 });
    }

    // DB token takes priority — it's the proper gho_ OAuth token with repo scope.
    // session.provider_token is a ghu_ GitHub App token with no repo scope — skip it.
    const { data: userData } = await adminClient
      .from("users")
      .select("github_access_token")
      .eq("id", user.id)
      .single();
    const dbToken = userData?.github_access_token;
    // Only use DB token if it's a proper OAuth token (gho_); never use ghu_ tokens
    let githubToken: string | null = null;
    if (dbToken && !dbToken.startsWith('ghu_')) {
      githubToken = dbToken;
    } else if (bodyToken && !bodyToken.startsWith('ghu_')) {
      githubToken = bodyToken;
    }
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

    // For URL-only scans, create a placeholder repo so repo_id is never null
    if (!repoUuid && deployed_url) {
      const urlLabel = new URL(deployed_url).hostname.replace(/[^a-z0-9-]/g, '-');
      const { data: urlRepo } = await adminClient
        .from("repos")
        .upsert({
          user_id: user.id,
          github_repo_id: "url-" + Buffer.from(deployed_url).toString("hex").substring(0, 16),
          name: urlLabel,
          full_name: "url-scan/" + urlLabel,
          is_private: false,
        }, { onConflict: "user_id,github_repo_id" })
        .select("id")
        .single();
      if (urlRepo) repoUuid = urlRepo.id;
    }

    // Create scan record
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
    after(() => processScan(scan.id, repo_full_name ?? null, githubToken ?? null, user.id, repoUuid, deployed_url));

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
        const severity = mapSeverity(f.extra.severity);
        // Strip /tmp/vibetrace-scan-XXXX/ prefix so users see clean relative paths
        const cleanPath = repoPath ? f.path.replace(repoPath + "/", "") : f.path;
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
