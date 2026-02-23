import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || origin;

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

    await supabase.auth.exchangeCodeForSession(code);

    // Check if user already has a GitHub OAuth token stored
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { data } = await admin
        .from("users")
        .select("github_access_token")
        .eq("id", user.id)
        .single();

      // Redirect through OAuth App if no token, or only has a ghu_ GitHub App token (no repo scope)
      const tok = data?.github_access_token ?? ''
      if (!tok || tok.startsWith('ghu_')) {
        return NextResponse.redirect(`${appUrl}/api/github/connect`);
      }
    }
  }

  return NextResponse.redirect(`${appUrl}/dashboard`);
}
