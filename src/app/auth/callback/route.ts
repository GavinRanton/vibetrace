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

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
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

    const { data: sessionData } = await supabase.auth.exchangeCodeForSession(code);
    
    // Persist the GitHub access token to the users table so it survives session refresh
    const session = sessionData?.session;
    if (session?.provider_token && session.user?.id) {
      const ghToken = session.provider_token;
      const userId = session.user.id;
      
      // Fetch GitHub username using the token
      let githubUsername: string | null = null;
      try {
        const ghRes = await fetch("https://api.github.com/user", {
          headers: { Authorization: `token ${ghToken}`, "User-Agent": "vibetrace" },
        });
        if (ghRes.ok) {
          const ghUser = await ghRes.json();
          githubUsername = ghUser.login ?? null;
        }
      } catch {}
      
      // Save token + username to users table
      await adminClient.from("users").upsert({
        id: userId,
        email: session.user.email ?? undefined,
        github_access_token: ghToken,
        ...(githubUsername ? { github_username: githubUsername } : {}),
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || origin;
  return NextResponse.redirect(`${appUrl}/dashboard`);
}
