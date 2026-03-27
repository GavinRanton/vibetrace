import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check founder status
  const admin = createAdminClient()
  const { data: userData } = await admin.from('users').select('plan').eq('id', user.id).single()
  if (userData?.plan !== 'founder') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('feedback')
    .select('id, category, message, response, responded_at, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check founder status
  const admin = createAdminClient()
  const { data: userData } = await admin.from('users').select('plan').eq('id', user.id).single()
  if (userData?.plan !== 'founder') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { message?: unknown; category?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const category = typeof body.category === 'string' ? body.category : ''

  if (!['bug', 'feature', 'general'].includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  if (message.length < 10) {
    return NextResponse.json({ error: 'Message must be at least 10 characters' }, { status: 400 })
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'Message must be 2000 characters or fewer' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('feedback')
    .insert({ user_id: user.id, category, message })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}
