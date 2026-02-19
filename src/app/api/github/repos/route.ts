import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get GitHub access token from session
  const githubToken = session.provider_token;
  if (!githubToken) {
    return NextResponse.json({ error: "No GitHub token" }, { status: 401 });
  }

  // Fetch repos from GitHub API
  const response = await fetch("https://api.github.com/user/repos?per_page=50&sort=updated", {
    headers: {
      Authorization: `token ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to fetch repos" }, { status: response.status });
  }

  const repos = await response.json();
  
  // Return simplified repo list
  const simplified = repos.map((repo: any) => ({
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    private: repo.private,
    default_branch: repo.default_branch,
    language: repo.language,
    updated_at: repo.updated_at,
    html_url: repo.html_url,
  }));

  return NextResponse.json({ repos: simplified });
}
