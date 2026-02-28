import { randomUUID } from "crypto";
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

function buildShareUrl(request: NextRequest, token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return `${appUrl.replace(/\/$/, "")}/report/${token}`;
  const origin = request.nextUrl.origin || "https://vibetrace.io";
  return `${origin}/report/${token}`;
}

async function getAuthedUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
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
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scanId } = await params;
  const { data: scan, error: scanError } = await adminClient
    .from("scans")
    .select("id, user_id, share_token")
    .eq("id", scanId)
    .single();

  if (scanError || !scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }
  if (scan.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const token = scan.share_token || randomUUID();
  const { error: updateError } = await adminClient
    .from("scans")
    .update({ share_token: token, is_shared: true })
    .eq("id", scanId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to share scan" }, { status: 500 });
  }

  return NextResponse.json({
    share_token: token,
    is_shared: true,
    share_url: buildShareUrl(request, token),
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { scanId } = await params;
  const { data: scan, error: scanError } = await adminClient
    .from("scans")
    .select("id, user_id")
    .eq("id", scanId)
    .single();

  if (scanError || !scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }
  if (scan.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error: updateError } = await adminClient
    .from("scans")
    .update({ is_shared: false })
    .eq("id", scanId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to revoke shared scan" }, { status: 500 });
  }

  return NextResponse.json({ is_shared: false });
}
