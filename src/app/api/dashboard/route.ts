import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SCANS_LIMIT: Record<string, number> = {
  free: 5,
  starter: 999,
  pro: 999,
};

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

    // Find the LATEST completed scan — dashboard always reflects the most recent result
    const { data: latestScan } = await db
      .from("scans")
      .select("id, completed_at, score, total_findings, critical_count, high_count, medium_count, low_count, repo_full_name")
      .eq("user_id", userId)
      .eq("status", "complete")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Fetch findings for that scan only
    let findings: Record<string, unknown>[] = [];
    let severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };

    if (latestScan) {
      const { data: findingsData } = await db
        .from("findings")
        .select("id, severity, category, file_path, line_number, plain_english, fix_prompt, verification_step, status, created_at")
        .eq("scan_id", latestScan.id)
        .order("severity", { ascending: true });

      findings = findingsData ?? [];

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
