import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Soft-delete in public.users table
  await admin
    .from('users')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', user.id)

  // Hard-delete from Supabase Auth (admin bypass)
  await admin.auth.admin.deleteUser(user.id)

  // Sign out current session
  await supabase.auth.signOut()

  return NextResponse.json({ success: true }, { status: 200 })
}
