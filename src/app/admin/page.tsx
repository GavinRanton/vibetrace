'use client'

import { useState, useEffect } from 'react'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { AppSidebar } from "@/components/app-sidebar"
import { Menu } from "lucide-react"

const ADMIN_EMAIL = "gavin.ranton@gmail.com"

type UserData = {
  id: string
  email: string
  plan: string
  scan_count: number
  created_at: string
}

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [searchEmail, setSearchEmail] = useState('')
  const [userData, setUserData] = useState<UserData | null>(null)
  const [selectedPlan, setSelectedPlan] = useState('')
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/admin/user?email=' + encodeURIComponent(ADMIN_EMAIL))
      .then((res) => setAuthorized(res.status !== 404))
      .catch(() => setAuthorized(false))
  }, [])

  if (authorized === null) return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
      <div className="text-white/40">Loading…</div>
    </div>
  )

  if (authorized === false) notFound()

  const sidebarProps = { activePath: '/admin', userEmail: ADMIN_EMAIL }

  const handleSearch = async () => {
    if (!searchEmail.trim()) return
    setSearching(true)
    setMessage(null)
    setUserData(null)
    try {
      const res = await fetch(`/api/admin/user?email=${encodeURIComponent(searchEmail.trim())}`)
      if (res.status === 404) {
        setMessage({ type: 'warning', text: 'No account found for that email' })
      } else if (!res.ok) {
        setMessage({ type: 'error', text: 'Failed to search. Try again.' })
      } else {
        const data = await res.json()
        setUserData(data.user)
        setSelectedPlan(data.user.plan)
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Try again.' })
    } finally {
      setSearching(false)
    }
  }

  const handleSave = async () => {
    if (!userData || !selectedPlan) return
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userData.email, plan: selectedPlan }),
      })
      if (!res.ok) {
        setMessage({ type: 'error', text: 'Failed to update. Try again.' })
      } else {
        setMessage({ type: 'success', text: `Plan updated to ${selectedPlan} for ${userData.email}` })
        setUserData({ ...userData, plan: selectedPlan })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Try again.' })
    } finally {
      setSaving(false)
    }
  }

  const planColors: Record<string, { bg: string; text: string }> = {
    free:    { bg: 'rgba(107,114,128,0.2)', text: '#9CA3AF' },
    starter: { bg: 'rgba(59,130,246,0.2)',  text: '#3B82F6' },
    pro:     { bg: 'rgba(16,185,129,0.2)',  text: '#10B981' },
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="flex">
        <aside className="hidden md:flex md:w-56 md:fixed md:inset-y-0 border-r border-white/5 flex-col p-4 shrink-0">
          <AppSidebar {...sidebarProps} />
        </aside>

        <div className="md:ml-56 flex-1 flex flex-col min-h-screen">
          <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0A0A0F] sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <img src="/branding/logo-icon-dark.svg" alt="VibeTrace" className="w-6 h-6" />
              <span className="font-semibold text-sm">VibeTrace</span>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white/60"><Menu className="w-5 h-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-56 bg-[#0A0A0F] border-white/5 p-4 flex flex-col">
                <AppSidebar {...sidebarProps} />
              </SheetContent>
            </Sheet>
          </div>

          <main className="flex-1 p-4 md:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold">Admin Panel</h1>
              <p className="text-white/40 text-sm mt-1">Search users and manage their plan.</p>
            </div>

            <Card className="w-full max-w-lg bg-white/[0.02] border-white/5">
              <CardHeader>
                <CardTitle className="text-base">Find a user</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#3B82F6]"
                  />
                  <Button onClick={handleSearch} disabled={searching} className="bg-[#3B82F6] hover:bg-[#2563EB] text-white">
                    {searching ? '…' : 'Search'}
                  </Button>
                </div>

                {message && (
                  <div className={`px-3 py-2 rounded-md text-sm ${
                    message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : message.type === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {message.text}
                  </div>
                )}

                {userData && (
                  <div className="space-y-4 p-4 rounded-md bg-white/[0.03] border border-white/5">
                    {[
                      { label: 'Email',      value: <span className="text-white font-medium">{userData.email}</span> },
                      { label: 'Plan',       value: <Badge style={{ backgroundColor: planColors[userData.plan]?.bg, color: planColors[userData.plan]?.text }}>{userData.plan}</Badge> },
                      { label: 'Scans',      value: <span className="text-white">{userData.scan_count}</span> },
                      { label: 'Joined',     value: <span className="text-white/60 text-sm">{new Date(userData.created_at).toLocaleDateString('en-GB')}</span> },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between">
                        <span className="text-white/40 text-sm">{row.label}</span>
                        {row.value}
                      </div>
                    ))}
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-4">
                      <span className="text-white/40 text-sm">Change plan</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedPlan}
                          onChange={(e) => setSelectedPlan(e.target.value)}
                          className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#3B82F6]"
                        >
                          <option value="free">Free</option>
                          <option value="starter">Starter</option>
                          <option value="pro">Pro</option>
                        </select>
                        <Button
                          onClick={handleSave}
                          disabled={saving || selectedPlan === userData.plan}
                          className="bg-[#3B82F6] hover:bg-[#2563EB] text-white disabled:opacity-50"
                        >
                          {saving ? 'Saving…' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    </div>
  )
}
