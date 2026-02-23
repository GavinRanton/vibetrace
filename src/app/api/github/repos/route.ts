import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get token from DB (survives session refresh), fall back to session provider_token
  const { data: userData } = await adminClient
    .from("users")
    .select("github_access_token")
    .eq("id", user.id)
    .single();

  // Also try session provider_token as fallback
  const { data: { session } } = await supabase.auth.getSession();
  const githubToken = userData?.github_access_token || session?.provider_token;

  if (!githubToken) {
    return NextResponse.json({ error: "No GitHub token — please sign out and sign in again" }, { status: 401 });
  }

  // Save to DB if we only had it from session (so it persists)
  if (!userData?.github_access_token && session?.provider_token) {
    await adminClient.from("users").update({
      github_access_token: session.provider_token,
    }).eq("id", user.id);
  }

  // Fetch ALL repos from GitHub (public + private)
  const response = await fetch(
    "https://api.github.com/user/repos?per_page=100&sort=updated&visibility=all&affiliation=owner,collaborator,organization_member",
    {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("[GitHub repos] API error:", response.status, errText);
    return NextResponse.json({ error: "Failed to fetch repos" }, { status: response.status });
  }

  const repos = await response.json();
  
  return NextResponse.json({
    repos: repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      private: repo.private,
      default_branch: repo.default_branch,
      language: repo.language,
      updated_at: repo.updated_at,
      html_url: repo.html_url,
    })),
  });
}
