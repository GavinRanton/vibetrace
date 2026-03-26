import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/feedback — create feedback (founder only)
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { category, message } = await req.json();

  if (!["bug", "feature", "general"].includes(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }
  if (!message || message.length < 10 || message.length > 2000) {
    return NextResponse.json({ error: "Message must be 10–2000 characters" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("feedback")
    .insert({ user_id: user.id, category, message })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// GET /api/feedback — list user's last 5 feedback submissions
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { data, error } = await supabase
    .from("feedback")
    .select("id, category, message, status, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    if (error.message.includes("does not exist")) return NextResponse.json([]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
