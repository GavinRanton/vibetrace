import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const { github_token } = await request.json();
    if (!github_token) {
      return NextResponse.json({ error: "No token provided" }, { status: 400 });
    }

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

    // Verify the token is actually a valid GitHub token
    const ghRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `token ${github_token}`, "User-Agent": "vibetrace" },
    });
    
    if (!ghRes.ok) {
      return NextResponse.json({ error: "Invalid GitHub token" }, { status: 400 });
    }
    
    const ghUser = await ghRes.json();
    const githubUsername = ghUser.login ?? null;

    // Save to DB
    const { error: upsertError } = await adminClient.from("users").upsert({
      id: user.id,
      email: user.email ?? undefined,
      github_access_token: github_token,
      ...(githubUsername ? { github_username: githubUsername } : {}),
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (upsertError) {
      console.error("[save-github-token] DB error:", upsertError.message);
      return NextResponse.json({ error: "Failed to save token" }, { status: 500 });
    }

    console.log("[save-github-token] Saved token for user:", user.id, "github:", githubUsername);
    return NextResponse.json({ ok: true, github_username: githubUsername });
  } catch (err: any) {
    console.error("[save-github-token] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
