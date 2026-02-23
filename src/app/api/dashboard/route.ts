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

    // Auth client (anon key) — used only to get the session
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

    // Fetch user record
    const { data: userData, error: userError } = await db
      .from("users")
      .select("plan, scan_count")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error("Dashboard: failed to fetch user:", userError);
      return NextResponse.json(
        { error: "Failed to load dashboard" },
        { status: 500 }
      );
    }

    const plan: string = userData?.plan ?? "free";
    const scanCount: number = userData?.scan_count ?? 0;
    const scansLimit: number = SCANS_LIMIT[plan] ?? 5;

    // Fetch latest 20 findings via scans join
    const { data: findingsData, error: findingsError } = await db
      .from("findings")
      .select(
        `id, severity, category, file_path, plain_english, fix_prompt, status, created_at,
         scans!inner ( user_id )`
      )
      .eq("scans.user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (findingsError) {
      console.error("Dashboard: failed to fetch findings:", findingsError);
      return NextResponse.json(
        { error: "Failed to load dashboard" },
        { status: 500 }
      );
    }

    // Fetch last scan date
    const { data: lastScanData, error: lastScanError } = await db
      .from("scans")
      .select("completed_at")
      .eq("user_id", userId)
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastScanError) {
      console.error("Dashboard: failed to fetch last scan:", lastScanError);
      return NextResponse.json(
        { error: "Failed to load dashboard" },
        { status: 500 }
      );
    }

    // Strip the nested scans join field before returning
    const findings = (findingsData ?? []).map((f) => {
      const { scans: _scans, ...rest } = f as typeof f & { scans: unknown };
      return rest;
    });

    // Severity counts
    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings) {
      const sev = (f.severity as string)?.toLowerCase();
      if (sev in severityCounts) {
        severityCounts[sev as keyof typeof severityCounts]++;
      }
    }

    return NextResponse.json({
      plan,
      scan_count: scanCount,
      scans_limit: scansLimit,
      findings,
      severity_counts: severityCounts,
      last_scan_at: lastScanData?.completed_at ?? null,
      user_email: user.email ?? null,
    });
  } catch (err) {
    console.error("Dashboard: unexpected error:", err);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
