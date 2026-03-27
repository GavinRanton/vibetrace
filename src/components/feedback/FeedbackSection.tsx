'use client'

import { useEffect, useState } from 'react'

interface FeedbackItem {
  id: string
  category: string
  message: string
  response: string | null
  responded_at: string | null
  status: string
  created_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'Bug Report',
  feature: 'Feature Request',
  general: 'General Feedback',
}

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
  new: { label: 'Submitted', color: '#F59E0B' },
  read: { label: 'Read', color: '#3B82F6' },
  responded: { label: 'Responded', color: '#10B981' },
}

export function FeedbackSection({ userPlan }: { userPlan: string }) {
  const [category, setCategory] = useState('general')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [previous, setPrevious] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userPlan !== 'founder') return
    fetch('/api/feedback')
      .then((r) => r.json())
      .then((json) => { if (json.data) setPrevious(json.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userPlan])

  if (userPlan !== 'founder') return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setSubmitSuccess(false)

    if (message.trim().length < 10) {
      setSubmitError('Message must be at least 10 characters')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message: message.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSubmitError(json.error || 'Failed to submit')
        return
      }
      setSubmitSuccess(true)
      setMessage('')
      setCategory('general')
      if (json.data) setPrevious((prev) => [json.data, ...prev].slice(0, 20))
      setTimeout(() => setSubmitSuccess(false), 4000)
    } catch {
      setSubmitError('Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-8 rounded-xl border border-white/5 bg-white/[0.02] p-6">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
        <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-4 4v-4z" />
        </svg>
        Founder Feedback
      </h2>
      <p className="text-sm text-white/50 mb-5">
        As a Founder Member, your feedback goes directly to the dev team.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="bug">Bug Report</option>
            <option value="feature">Feature Request</option>
            <option value="general">General Feedback</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-1">
            Message <span className="font-normal text-white/40">({message.length}/2000)</span>
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Describe the bug, feature idea, or your thoughts..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
          />
        </div>

        {submitError && <p className="text-sm text-red-400">{submitError}</p>}
        {submitSuccess && <p className="text-sm text-emerald-400">Feedback submitted — thank you!</p>}

        <button
          type="submit"
          disabled={submitting || message.trim().length < 10}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Sending...' : 'Send Feedback'}
        </button>
      </form>

      {/* Previous feedback */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold text-white/70 mb-3">Your recent feedback</h3>

        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500" />
          </div>
        ) : previous.length === 0 ? (
          <p className="text-sm text-white/40">No feedback submitted yet.</p>
        ) : (
          <ul className="space-y-3">
            {previous.map((item) => {
              const style = STATUS_STYLES[item.status] ?? STATUS_STYLES.new
              return (
                <li key={item.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium text-white/50">
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </span>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: `${style.color}20`, color: style.color }}
                    >
                      {style.label}
                    </span>
                  </div>
                  <p className="text-sm text-white/80">{item.message}</p>
                  <p className="text-xs text-white/40 mt-1">
                    {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {item.response && (
                    <div className="mt-3 p-3 rounded-md border-l-4 border-blue-500 bg-blue-500/10">
                      <div className="flex items-center gap-1.5 mb-1">
                        <svg className="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        <span className="text-xs font-semibold text-blue-400">VibeTrace Team</span>
                        {item.responded_at && (
                          <span className="text-xs text-white/40">
                            · {new Date(item.responded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-white/80">{item.response}</p>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
