import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, after } from "next/server";
import type { NextRequest } from "next/server";
import { adminClient } from "@/lib/supabase-admin";
import { processScan } from "@/lib/scanner/pipeline";

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
