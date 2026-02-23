import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SCANS_LIMIT: Record<string, number> = {
  free: 5,
  starter: 999,
  pro: 999,
};

function stripHtml(input: string): string {
  return (input || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function buildActualError(f: any): string {
  const parts: string[] = [];

  if (f.rule_id) parts.push(`Rule: ${f.rule_id}`);

  const loc = f.file_path
    ? `${f.file_path}${f.line_number ? `:${f.line_number}` : ""}`
    : null;
  if (loc) parts.push(`Location: ${loc}`);

  const ro = f.raw_output;
  const semgrepMsg = ro?.extra?.message || ro?.message;
  if (semgrepMsg) parts.push(`Message: ${String(semgrepMsg).trim()}`);

  const zapName = ro?.name;
  const zapRisk = ro?.riskdesc || ro?.risk;
  if (zapName) parts.push(`ZAP: ${stripHtml(String(zapName))}${zapRisk ? ` — ${stripHtml(String(zapRisk))}` : ""}`);
  if (ro?.desc) parts.push(`Description: ${stripHtml(String(ro.desc))}`);
  if (ro?.evidence) parts.push(`Evidence: ${stripHtml(String(ro.evidence))}`);
  if (ro?.solution) parts.push(`Suggested fix: ${stripHtml(String(ro.solution))}`);

  if (f.code_snippet) parts.push(`Snippet:\n${String(f.code_snippet).trim()}`);

  const out = parts.filter(Boolean).join("\n\n").trim();
  return out.length > 8000 ? out.slice(0, 8000) + "…" : out;
}

export async function GET() {
  try {
    const cookieStore = await cookies();

    const authClient = createServerClient(
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

    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    const db = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
          },
        },
      }
    );

    // Fetch user record
    const { data: userData } = await db
      .from("users")
      .select("plan, scan_count")
      .eq("id", userId)
      .single();

    const plan: string = userData?.plan ?? "free";
    const scanCount: number = userData?.scan_count ?? 0;
    const scansLimit: number = SCANS_LIMIT[plan] ?? 5;

    // Find the LATEST completed scan — join repos table for repo name
    const { data: latestScanRaw, error: scanError } = await db
      .from("scans")
      .select("id, completed_at, score, total_findings, critical_count, high_count, medium_count, low_count, repo_id, repos ( full_name )")
      .eq("user_id", userId)
      .eq("status", "complete")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (scanError) {
      console.error("Dashboard: scan query error:", scanError);
    }

    // Flatten the repos join
    const latestScan = latestScanRaw
      ? {
          ...latestScanRaw,
          repo_full_name: (latestScanRaw.repos as any)?.full_name ?? null,
        }
      : null;

    // Fetch findings for that scan only
    let findings: Record<string, unknown>[] = [];
    let severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };

    if (latestScan) {
      const { data: findingsData } = await db
        .from("findings")
        .select("id, severity, category, rule_id, file_path, line_number, code_snippet, raw_output, plain_english, fix_prompt, verification_step, status, created_at")
        .eq("scan_id", latestScan.id)
        .order("severity", { ascending: true });

      findings = (findingsData ?? []).map((f: any) => ({
        ...f,
        actual_error: buildActualError(f),
      }));

      // Use scan-level counts if available, otherwise compute from findings
      if (latestScan.critical_count !== null) {
        severityCounts = {
          critical: latestScan.critical_count ?? 0,
          high:     latestScan.high_count     ?? 0,
          medium:   latestScan.medium_count   ?? 0,
          low:      latestScan.low_count      ?? 0,
        };
      } else {
        for (const f of findings) {
          const sev = (f.severity as string)?.toLowerCase();
          if (sev in severityCounts) severityCounts[sev as keyof typeof severityCounts]++;
        }
      }
    }

    return NextResponse.json({
      plan,
      scan_count: scanCount,
      scans_limit: scansLimit,
      findings,
      severity_counts: severityCounts,
      last_scan_at: latestScan?.completed_at ?? null,
      latest_scan_repo: latestScan?.repo_full_name ?? null,
      user_email: user.email ?? null,
    });
  } catch (err) {
    console.error("Dashboard: unexpected error:", err);
    return NextResponse.json({ error: "Failed to load dashboard" }, { status: 500 });
  }
}
