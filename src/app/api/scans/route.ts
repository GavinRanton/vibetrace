import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scanId = searchParams.get("scan_id");
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
      file_path: string;
      line_number: number | null;
      plain_english: string;
      fix_prompt: string;
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
            "id, severity, category, file_path, line_number, plain_english, fix_prompt, status, created_at"
          )
          .eq("scan_id", scanId)
          .order("severity", { ascending: true });

        if (!findingsError && findingsData) {
          findings = findingsData;
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
