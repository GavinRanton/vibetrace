import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: userData } = await admin
    .from('users')
    .select('plan')
    .eq('id', user.id)
    .single()

  const { data: scans } = await admin
    .from('scans')
    .select('*')
    .eq('user_id', user.id)

  const scansWithFindings = await Promise.all(
    (scans ?? []).map(async (scan: Record<string, unknown>) => {
      const { data: findings } = await admin
        .from('findings')
        .select('*')
        .eq('scan_id', scan.id)
      return { ...scan, findings: findings ?? [] }
    })
  )

  const payload = {
    user: {
      email: user.email,
      plan: userData?.plan ?? 'free',
    },
    scans: scansWithFindings,
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename=vibetrace-export.json',
    },
  })
}
