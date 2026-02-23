import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || ''

  if (!code || !state) return NextResponse.redirect(`${siteUrl}/dashboard`)

  let userId: string
  let next = '/dashboard'
  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString())
    userId = parsed.userId
    if (parsed.next) next = parsed.next
    if (!userId) throw new Error('no userId')
  } catch {
    return NextResponse.redirect(`${siteUrl}/dashboard`)
  }

  // Exchange code for token
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_OAUTH_CLIENT_ID,
      client_secret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
      code,
      redirect_uri: `${siteUrl}/api/github/callback`,
    }),
  })
  const tokenData = await tokenRes.json()
  const accessToken: string = tokenData.access_token
  if (!accessToken) return NextResponse.redirect(`${siteUrl}/dashboard`)

  // Fetch GitHub username
  const ghUser = await fetch('https://api.github.com/user', {
    headers: { Authorization: `token ${accessToken}`, 'User-Agent': 'vibetrace' },
  }).then(r => r.json())

  const admin = createAdminClient()
  await admin.from('users').update({
    github_access_token: accessToken,
    github_username: ghUser.login ?? null,
  }).eq('id', userId)

  console.log(`[github/callback] Saved token for user ${userId} (${ghUser.login})`)
  return NextResponse.redirect(`${siteUrl}${next}`)
}
