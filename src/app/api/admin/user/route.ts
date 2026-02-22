import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const ADMIN_EMAIL = "gavin.ranton@gmail.com";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Auth client — get current user session
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

    if (authError || !user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Get email query param
    const email = req.nextUrl.searchParams.get("email");
    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    // Service-role client for DB queries
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

    const { data: userData, error: userError } = await db
      .from("users")
      .select("id, email, plan, scan_count, created_at")
      .eq("email", email)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: userData });
  } catch (err) {
    console.error("Admin GET: unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Auth client — get current user session
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

    if (authError || !user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Parse request body
    const body = await req.json();
    const { email, plan } = body;

    if (!email || !plan) {
      return NextResponse.json({ error: "Email and plan required" }, { status: 400 });
    }

    if (!["free", "starter", "pro"].includes(plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Service-role client for DB queries
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

    const { data: updatedUser, error: updateError } = await db
      .from("users")
      .update({ plan })
      .eq("email", email)
      .select("email, plan")
      .single();

    if (updateError || !updatedUser) {
      console.error("Admin PATCH: update error:", updateError);
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error("Admin PATCH: unexpected error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
