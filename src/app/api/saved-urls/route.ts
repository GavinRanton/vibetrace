import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/saved-urls — list user's saved URLs
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data, error } = await supabase
    .from("saved_urls")
    .select("id, url, label, scan_count, last_scanned_at")
    .eq("user_id", user.id)
    .order("last_scanned_at", { ascending: false })
    .limit(20);

  // If table doesn't exist yet, return empty array gracefully
  if (error) {
    if (error.message.includes("does not exist")) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST /api/saved-urls — save or upsert a URL
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { url, label } = await req.json();
  if (!url || !url.startsWith("https://")) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("saved_urls")
    .upsert(
      {
        user_id: user.id,
        url: url.toLowerCase().trim(),
        label: label || null,
        scan_count: 1,
        last_scanned_at: new Date().toISOString(),
      },
      { onConflict: "user_id,url", ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
