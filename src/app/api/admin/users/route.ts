import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ADMIN_EMAIL = "gavin.ranton@gmail.com";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(s) { try { s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
        },
      }
    );
    const { data: { user }, error } = await authClient.auth.getUser();
    if (error || !user || user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
    }

    const db = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(s) { try { s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
        },
      }
    );

    const { data: users, error: usersError } = await db
      .from("users")
      .select("id, email, plan, scan_count, created_at")
      .order("created_at", { ascending: false });

    if (usersError) {
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json({ users: users ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error("Admin users API error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
