import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL!))

  const state = Buffer.from(JSON.stringify({ userId: user.id, ts: Date.now() })).toString('base64url')
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_OAUTH_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/github/callback`,
    scope: 'repo read:user user:email',
    state,
  })
  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params}`)
}
