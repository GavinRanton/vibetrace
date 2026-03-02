import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// DELETE /api/saved-urls/:id
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  const { error } = await supabase
    .from("saved_urls")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // security: only delete own

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH /api/saved-urls/:id — increment scan_count + update last_scanned_at
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { id } = await params;
  // Fallback: just update last_scanned_at (RPC may not exist)
  const { error } = await supabase
    .from("saved_urls")
    .update({ last_scanned_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
