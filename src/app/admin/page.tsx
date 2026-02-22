'use client'

import { useState, useEffect } from 'react'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type UserData = {
  id: string
  email: string
  plan: string
  scan_count: number
  created_at: string
}

const ADMIN_EMAIL = "gavin.ranton@gmail.com"

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [searchEmail, setSearchEmail] = useState('')
  const [userData, setUserData] = useState<UserData | null>(null)
  const [selectedPlan, setSelectedPlan] = useState('')
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'warning' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => {
        if (res.status === 401) {
          setAuthorized(false)
          return null
        }
        return res.json()
      })
      .then((data) => {
        if (data === null) return
        // Check if current user email matches admin
        // Dashboard doesn't return email, so we check via admin endpoint
        fetch('/api/admin/user?email=' + encodeURIComponent(ADMIN_EMAIL))
          .then((res) => {
            if (res.status === 404) {
              setAuthorized(false)
            } else {
              setAuthorized(true)
            }
          })
          .catch(() => setAuthorized(false))
      })
      .catch(() => setAuthorized(false))
  }, [])

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
        <div>Loading...</div>
      </div>
    )
  }

  if (authorized === false) {
    notFound()
  }

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
      setMessage({ type: 'error', text: 'Failed to search. Try again.' })
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
      setMessage({ type: 'error', text: 'Failed to update. Try again.' })
    } finally {
      setSaving(false)
    }
  }

  const planColors: Record<string, { bg: string; text: string }> = {
    free: { bg: 'rgba(107,114,128,0.2)', text: '#9CA3AF' },
    starter: { bg: 'rgba(59,130,246,0.2)', text: '#3B82F6' },
    pro: { bg: 'rgba(16,185,129,0.2)', text: '#10B981' },
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-white/[0.02] border-white/5">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-center">Admin Panel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search form */}
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Find user by email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1 px-3 py-2 rounded-md bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-[#3B82F6]"
            />
            <Button
              onClick={handleSearch}
              disabled={searching}
              className="bg-[#3B82F6] hover:bg-[#2563EB] text-white"
            >
              {searching ? '...' : 'Search'}
            </Button>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`px-3 py-2 rounded-md text-sm ${
                message.type === 'success'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : message.type === 'warning'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* User result */}
          {userData && (
            <div className="space-y-4 p-4 rounded-md bg-white/[0.03] border border-white/5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white/40 text-sm">Email</span>
                  <span className="text-white font-medium">{userData.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/40 text-sm">Current Plan</span>
                  <Badge
                    style={{
                      backgroundColor: planColors[userData.plan]?.bg ?? planColors.free.bg,
                      color: planColors[userData.plan]?.text ?? planColors.free.text,
                    }}
                  >
                    {userData.plan}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/40 text-sm">Scan Count</span>
                  <span className="text-white">{userData.scan_count}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-white/40 text-sm">Joined</span>
                  <span className="text-white/60 text-sm">
                    {new Date(userData.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-white/40 text-sm">Change Plan</span>
                  <select
                    value={selectedPlan}
                    onChange={(e) => setSelectedPlan(e.target.value)}
                    className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="free">free</option>
                    <option value="starter">starter</option>
                    <option value="pro">pro</option>
                  </select>
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saving || selectedPlan === userData.plan}
                  className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
