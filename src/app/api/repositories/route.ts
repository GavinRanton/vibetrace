import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

    // Fetch repos
    const { data: repos, error: repoError } = await db
      .from("repos")
      .select("id, full_name, name, is_private, last_scanned_at, created_at")
      .eq("user_id", user.id)
      .order("last_scanned_at", { ascending: false, nullsFirst: false });

    if (repoError) {
      return NextResponse.json({ error: "Failed to load repositories" }, { status: 500 });
    }

    // Fetch scan counts per repo
    const { data: scanCounts } = await db
      .from("scans")
      .select("repo_id")
      .eq("user_id", user.id)
      .in("status", ["complete", "failed"]);

    const countMap: Record<string, number> = {};
    for (const s of scanCounts ?? []) {
      if (s.repo_id) countMap[s.repo_id] = (countMap[s.repo_id] || 0) + 1;
    }

    const result = (repos ?? []).map((r) => ({
      ...r,
      scan_count: countMap[r.id] ?? 0,
    }));

    return NextResponse.json({ repos: result });
  } catch (err) {
    console.error("Repositories API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
