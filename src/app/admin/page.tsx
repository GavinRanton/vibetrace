'use client'

import { useState, useEffect } from 'react'
import { notFound } from 'next/navigation'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { AppSidebar } from "@/components/app-sidebar"
import { Menu, Search, Users } from "lucide-react"

const ADMIN_EMAIL = "gavin.ranton@gmail.com"

type User = {
  id: string
  email: string
  plan: string
  scan_count: number
  created_at: string
}

const planColors: Record<string, { bg: string; text: string }> = {
  free:    { bg: 'rgba(107,114,128,0.15)', text: '#9CA3AF' },
  starter: { bg: 'rgba(59,130,246,0.15)',  text: '#60A5FA' },
  pro:     { bg: 'rgba(16,185,129,0.15)',  text: '#34D399' },
}

function PlanSelect({ user, onChange }: { user: User; onChange: (u: User, plan: string) => void }) {
  const [saving, setSaving] = useState(false)
  const [plan, setPlan] = useState(user.plan)

  async function save(newPlan: string) {
    setSaving(true)
    setPlan(newPlan)
    try {
      await fetch('/api/admin/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, plan: newPlan }),
      })
      onChange(user, newPlan)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Badge style={{ backgroundColor: planColors[plan]?.bg, color: planColors[plan]?.text }}>
        {plan}
      </Badge>
      <select
        value={plan}
        onChange={(e) => save(e.target.value)}
        disabled={saving}
        className="text-xs px-2 py-1 rounded bg-white/5 border border-white/10 text-white/70 focus:outline-none focus:border-[#3B82F6] disabled:opacity-50"
      >
        <option value="free">free</option>
        <option value="starter">starter</option>
        <option value="pro">pro</option>
      </select>
      {saving && <span className="text-white/30 text-xs">saving…</span>}
    </div>
  )
}

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [users, setUsers] = useState<User[]>([])
  const [filter, setFilter] = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)

  useEffect(() => {
    fetch('/api/admin/user?email=' + encodeURIComponent(ADMIN_EMAIL))
      .then((res) => {
        setAuthorized(res.status !== 404)
        if (res.status !== 404) loadUsers()
      })
      .catch(() => setAuthorized(false))
  }, [])

  function loadUsers() {
    setLoadingUsers(true)
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => { setUsers(d.users ?? []); setLoadingUsers(false) })
      .catch(() => setLoadingUsers(false))
  }

  function handlePlanChange(user: User, newPlan: string) {
    setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, plan: newPlan } : u))
  }

  if (authorized === null) return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
      <div className="text-white/40">Loading…</div>
    </div>
  )

  if (authorized === false) notFound()

  const sidebarProps = { activePath: '/admin', userEmail: ADMIN_EMAIL }

  const filtered = users.filter((u) =>
    u.email.toLowerCase().includes(filter.toLowerCase())
  )

  const planCounts = users.reduce((acc, u) => {
    acc[u.plan] = (acc[u.plan] || 0) + 1
    return acc
  }, {} as Record<string, number>)

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
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold">Admin</h1>
                <p className="text-white/40 text-sm mt-1">{users.length} users · {planCounts.pro ?? 0} pro · {planCounts.starter ?? 0} starter · {planCounts.free ?? 0} free</p>
              </div>
              <Users className="w-6 h-6 text-white/20" />
            </div>

            {/* Filter */}
            <div className="relative mb-6 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="text"
                placeholder="Filter by email…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-[#3B82F6] text-sm"
              />
            </div>

            {loadingUsers ? (
              <div className="text-white/40 text-center py-16">Loading users…</div>
            ) : (
              <Card className="bg-white/[0.02] border-white/5">
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-white/5 text-white/40">
                        <th className="text-left px-6 py-3 font-medium">Email</th>
                        <th className="text-left px-6 py-3 font-medium">Plan</th>
                        <th className="text-left px-6 py-3 font-medium">Scans</th>
                        <th className="text-left px-6 py-3 font-medium">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-white/30">
                            {filter ? 'No users match that filter.' : 'No users yet.'}
                          </td>
                        </tr>
                      ) : filtered.map((u) => (
                        <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.03] last:border-0">
                          <td className="px-6 py-4 text-white/80 font-mono text-sm">{u.email}</td>
                          <td className="px-6 py-4">
                            <PlanSelect user={u} onChange={handlePlanChange} />
                          </td>
                          <td className="px-6 py-4 text-white/50">{u.scan_count}</td>
                          <td className="px-6 py-4 text-white/40 text-xs whitespace-nowrap">
                            {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
