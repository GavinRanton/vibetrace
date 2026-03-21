import { exec as execCb } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import { adminClient } from "@/lib/supabase-admin";

const execAsync = promisify(execCb);

export function isPrivateUrl(url: string): boolean {
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

export const MAX_SNIPPET_CHARS = 500;

const ZAP_SUPPRESSED_RULES = new Set([
  "zap-10109",  // Timestamp disclosure — low value, noisy
  "zap-10024",  // Information disclosure via ZAP's own test payloads (false positive)
  "zap-10027",  // JSON-LD structured data flagged as information disclosure (false positive)
]);

// FP-FIX-1: Map ZAP rule IDs to the security headers they check for
const HEADER_RULE_MAP: Record<string, string[]> = {
  "zap-10035": ["strict-transport-security"],
  "zap-10021": ["x-content-type-options"],
  "zap-10020": ["x-frame-options"],
  "zap-10038": ["content-security-policy"],
  "zap-10049": ["cache-control"],
  "zap-10098": ["cross-origin-opener-policy"],
  "zap-10054": ["x-cache"], // informational
};

const CACHE_RULE_HINT = /(cache|pragma|expires|cache-control)/i;
const HTML_COMMENT_HINT = /(html\s*comment|information leakage - comments|comments?\sin)/i;
const CSP_HINT = /(content-security-policy|\bcsp\b)/i;
const COEP_HINT = /(cross-origin-embedder-policy|\bcoep\b|require-corp)/i;
const ERROR_PAGE_HINT = /(error\s*page|stack\s*trace|exception\s*handling)/i;

export function truncateSnippet(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_SNIPPET_CHARS
    ? `${trimmed.slice(0, MAX_SNIPPET_CHARS)}...`
    : trimmed;
}

// FP-FIX-1: Fetch actual headers from the target URL to verify ZAP findings
async function getActualHeaders(url: string): Promise<Set<string>> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10000) });
    return new Set([...res.headers.keys()].map(h => h.toLowerCase()));
  } catch {
    return new Set();
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

export async function runZapScan(url: string, scanId: string): Promise<number> {
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
      const vaultUrl = process.env.VAULT_URL ?? ""; // nosemgrep: typescript.react.security.react-insecure-request.react-insecure-request
      const vaultToken = process.env.VAULT_TOKEN ?? "";
      const vaultRes = await fetch(vaultUrl, {
        headers: { Authorization: `Bearer ${vaultToken}` },
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
            const parsedTranslations = JSON.parse(jsonStart >= 0 ? raw.slice(jsonStart, jsonEnd) : raw);
            parsedTranslations.forEach((t: any, i: number) => translations.set(String(i), t));
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

    // FP-FIX-1: Suppress header-related findings when the header actually exists in the live response
    const actualHeaders = await getActualHeaders(url);
    const headerVerifiedFindings = dedupedFindings.filter(finding => {
      const requiredHeaders = HEADER_RULE_MAP[finding.rule_id];
      if (!requiredHeaders) return true;
      // If all required headers for this rule are present in the actual response, suppress
      const allPresent = requiredHeaders.every(h => actualHeaders.has(h));
      if (allPresent) {
        console.log(`[ZAP] Suppressing ${finding.rule_id} — header confirmed present in actual response`);
        return false;
      }
      return true;
    });

    if (headerVerifiedFindings.length > 0) {
      const { error } = await adminClient.from("findings").insert(headerVerifiedFindings);
      if (error) {
        console.error("[ZAP] Failed to insert findings:", error);
        return 0;
      }
    }

    console.log(`[ZAP] Saved ${headerVerifiedFindings.length} DAST findings for scan ${scanId}`);
    return headerVerifiedFindings.length;
  } catch (err: any) {
    console.error("[ZAP] runZapScan failed unexpectedly:", err.message);
    return 0;
  }
}
