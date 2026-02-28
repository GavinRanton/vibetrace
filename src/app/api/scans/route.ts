import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scanId = searchParams.get("scan_id");

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
    // Semgrep
    const semgrepMsg = ro?.extra?.message || ro?.message;
    if (semgrepMsg) parts.push(`Message: ${String(semgrepMsg).trim()}`);
    if (ro?.extra?.metadata?.cwe) parts.push(`CWE: ${String(ro.extra.metadata.cwe)}`);

    // ZAP
    const zapName = ro?.name;
    const zapRisk = ro?.riskdesc || ro?.risk;
    if (zapName) parts.push(`ZAP: ${stripHtml(String(zapName))}${zapRisk ? ` — ${stripHtml(String(zapRisk))}` : ""}`);
    if (ro?.desc) parts.push(`Description: ${stripHtml(String(ro.desc))}`);
    if (ro?.evidence) parts.push(`Evidence: ${stripHtml(String(ro.evidence))}`);
    if (ro?.solution) parts.push(`Suggested fix: ${stripHtml(String(ro.solution))}`);

    if (f.code_snippet) {
      parts.push(`Snippet:\n${String(f.code_snippet).trim()}`);
    }

    const out = parts.filter(Boolean).join("\n\n").trim();
    return out.length > 8000 ? out.slice(0, 8000) + "…" : out;
  }
  try {
    const cookieStore = await cookies();

    // Auth client (anon key) — used only to get the user
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Service-role client — used for all DB queries
    const db = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    // Fetch scans joined with repos.full_name, ordered by created_at DESC
    const { data: scansData, error: scansError } = await db
      .from("scans")
      .select(`
        id,
        status,
        score,
        total_findings,
        critical_count,
        high_count,
        medium_count,
        low_count,
        started_at,
        completed_at,
        created_at,
        repo_id,
        zap_included,
        repos ( full_name )
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (scansError) {
      console.error("Scans API: failed to fetch scans:", scansError);
      return NextResponse.json(
        { error: "Failed to load scans" },
        { status: 500 }
      );
    }

    // Flatten repos join
    const scans = (scansData ?? []).map((s) => {
      const { repos, ...rest } = s as typeof s & { repos: { full_name: string } | null };
      return {
        ...rest,
        repo_full_name: repos?.full_name ?? null,
      };
    });

    // If scan_id is provided, also fetch findings for that scan
    let findings: Array<{
      id: string;
      severity: string;
      category: string;
      rule_id: string;
      file_path: string;
      line_number: number | null;
      code_snippet: string | null;
      raw_output: any;
      actual_error: string;
      plain_english: string;
      fix_prompt: string;
      business_impact: string | null;
      verification_step: string | null;
      status: string;
      created_at: string;
    }> = [];

    if (scanId) {
      // Verify the scan belongs to this user
      const scanBelongsToUser = scans.some((s) => s.id === scanId);
      if (scanBelongsToUser) {
        const { data: findingsData, error: findingsError } = await db
          .from("findings")
          .select(
            "id, severity, category, rule_id, file_path, line_number, code_snippet, raw_output, plain_english, business_impact, fix_prompt, verification_step, status, created_at"
          )
          .eq("scan_id", scanId)
          .order("severity", { ascending: true });

        if (!findingsError && findingsData) {
          findings = findingsData.map((f: any) => ({
            ...f,
            actual_error: buildActualError(f),
          }));
        }
      }
    }

    return NextResponse.json({ scans, findings });
  } catch (err) {
    console.error("Scans API: unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to load scans" },
      { status: 500 }
    );
  }
}
