'use client'

import { useState, useEffect, useCallback } from 'react'
import { Crown } from 'lucide-react'
import { toast } from 'sonner'

interface FeedbackEntry {
  id: string
  category: string
  message: string
  status: 'new' | 'read' | 'responded'
  created_at: string
}

const categoryLabels: Record<string, string> = {
  bug: 'Bug Report',
  feature: 'Feature Request',
  general: 'General Feedback',
}

const statusColors: Record<string, string> = {
  new: 'text-[#94A3B8] border-[#94A3B8]/30 bg-[#94A3B8]/10',
  read: 'text-[#3B82F6] border-[#3B82F6]/30 bg-[#3B82F6]/10',
  responded: 'text-[#22C55E] border-[#22C55E]/30 bg-[#22C55E]/10',
}

export function FounderFeedback() {
  const [category, setCategory] = useState<'bug' | 'feature' | 'general'>('general')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [history, setHistory] = useState<FeedbackEntry[]>([])

  const loadHistory = useCallback(async () => {
    const res = await fetch('/api/feedback')
    if (res.ok) {
      const data = await res.json()
      setHistory(data)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (message.length < 10) {
      toast.error('Message must be at least 10 characters')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? 'Failed to submit feedback')
        return
      }
      toast.success('Feedback submitted — thank you!')
      setMessage('')
      await loadHistory()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="border border-white/5 rounded-xl bg-[#1E1E2E]/60 mt-6">
      <div className="px-6 py-5 border-b border-white/5 flex items-center gap-2">
        <Crown className="w-4 h-4 text-[#F59E0B]" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#94A3B8]">Founder Feedback</h2>
      </div>
      <div className="px-6 py-5">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as typeof category)}
              className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-[#F8FAFC] focus:outline-none focus:border-white/20"
            >
              <option value="bug">Bug Report</option>
              <option value="feature">Feature Request</option>
              <option value="general">General Feedback</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#94A3B8] mb-1.5">
              Message <span className="text-[#94A3B8]/60">({message.length}/2000)</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
              rows={4}
              placeholder="Share your thoughts, bugs, or ideas…"
              className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]/50 focus:outline-none focus:border-white/20 resize-none"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={submitting || message.length < 10}
              className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-[#F59E0B]/20 border border-[#F59E0B]/30 text-[#F59E0B] hover:bg-[#F59E0B]/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting…' : 'Submit feedback'}
            </button>
          </div>
        </form>

        {history.length > 0 && (
          <div className="mt-6">
            <p className="text-xs text-[#94A3B8] mb-3 uppercase tracking-wider">Previous submissions</p>
            <div className="flex flex-col gap-3">
              {history.map((entry) => (
                <div key={entry.id} className="border border-white/5 rounded-lg px-4 py-3 bg-black/20">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-[#F8FAFC]">{categoryLabels[entry.category]}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColors[entry.status]}`}
                    >
                      {entry.status}
                    </span>
                  </div>
                  <p className="text-sm text-[#94A3B8] line-clamp-2">{entry.message}</p>
                  <p className="text-xs text-[#94A3B8]/50 mt-1.5">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
