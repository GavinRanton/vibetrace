import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AccountActions } from './AccountActions'
import { GitHubTokenSection } from './GitHubTokenSection'

export default async function AccountPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const admin = createAdminClient()

  const { data: userData } = await admin
    .from('users')
    .select('plan, github_access_token, github_username')
    .eq('id', user.id)
    .single()

  const { count: scanCount } = await admin
    .from('scans')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const plan: string = userData?.plan ?? 'free'
  const hasGithubToken = !!userData?.github_access_token
  const githubUsername: string | null = userData?.github_username ?? null
  const scansUsed = scanCount ?? 0
  const email = user.email ?? ''
  const initials = email.slice(0, 2).toUpperCase()

  const planLabel: Record<string, string> = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
  }

  const planColor: Record<string, string> = {
    free: '#94A3B8',
    starter: '#3B82F6',
    pro: '#8B5CF6',
  }

  const planLimit: Record<string, string> = {
    free: '5 scans / month',
    starter: '50 scans / month',
    pro: 'Unlimited scans',
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8FAFC]">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Back nav */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-[#94A3B8] hover:text-[#F8FAFC] mb-10 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Dashboard
        </Link>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Account</h1>
          <p className="text-[#94A3B8] mt-1 text-sm">{email}</p>
        </div>

        {/* Section 1: Profile */}
        <section className="border border-white/5 rounded-xl bg-[#1E1E2E]/60 mb-6">
          <div className="px-6 py-5 border-b border-white/5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#94A3B8]">Profile</h2>
          </div>
          <div className="px-6 py-5 flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
              style={{ backgroundColor: '#1E1E2E', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-[#F8FAFC] truncate">{email}</div>
              <div className="mt-1">
                <span
                  className="inline-block text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${planColor[plan] ?? planColor.free}20`,
                    color: planColor[plan] ?? planColor.free,
                    border: `1px solid ${planColor[plan] ?? planColor.free}40`,
                  }}
                >
                  {planLabel[plan] ?? 'Free'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Subscription */}
        <section className="border border-white/5 rounded-xl bg-[#1E1E2E]/60 mb-6">
          <div className="px-6 py-5 border-b border-white/5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#94A3B8]">Subscription</h2>
          </div>
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-medium">{planLabel[plan] ?? 'Free'} plan</div>
                <div className="text-xs text-[#94A3B8] mt-0.5">{planLimit[plan] ?? planLimit.free}</div>
              </div>
              <Link
                href="/pricing"
                className="text-xs text-[#3B82F6] hover:text-[#60A5FA] transition-colors"
              >
                View plans
              </Link>
            </div>
            <div className="flex items-center justify-between text-sm mb-5">
              <span className="text-[#94A3B8]">Scans used this month</span>
              <span className="font-medium tabular-nums">{scansUsed}</span>
            </div>
            <AccountActions section="subscription" />
          </div>
        </section>

        {/* Section 3: GitHub */}
        <section className="border border-white/5 rounded-xl bg-[#1E1E2E]/60 mb-6">
          <div className="px-6 py-5 border-b border-white/5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#94A3B8]">GitHub Integration</h2>
          </div>
          <div className="px-6 py-5">
            <GitHubTokenSection hasToken={hasGithubToken} githubUsername={githubUsername} />
          </div>
        </section>

        {/* Section 4: Data */}
        <section className="border border-white/5 rounded-xl bg-[#1E1E2E]/60">
          <div className="px-6 py-5 border-b border-white/5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#94A3B8]">Data</h2>
          </div>
          <div className="px-6 py-5">
            <AccountActions section="data" />
          </div>
        </section>
      </div>
    </div>
  )
}
