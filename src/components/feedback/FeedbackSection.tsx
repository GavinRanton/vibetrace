'use client'

import { useState } from 'react'

export function FeedbackSection() {
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const remaining = 2000 - message.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (message.trim().length < 10) return

    setStatus('submitting')
    setErrorMsg('')

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Something went wrong')
      }

      setStatus('success')
      setMessage('')
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  if (status === 'success') {
    return (
      <div className="px-6 py-5">
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            color: '#F59E0B',
          }}
        >
          Thank you — your feedback has been received. We read everything.
        </div>
        <button
          onClick={() => setStatus('idle')}
          className="mt-3 text-xs text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
        >
          Send more feedback
        </button>
      </div>
    )
  }

  return (
    <div className="px-6 py-5">
      <p className="text-sm text-[#94A3B8] mb-4">
        As a Founder Member your feedback shapes the product roadmap. Tell us what to build next, what&apos;s
        missing, or anything else on your mind.
      </p>
      <form onSubmit={handleSubmit}>
        <textarea
          value={message}
          onChange={(e) => {
            setMessage(e.target.value)
            if (status === 'error') setStatus('idle')
          }}
          placeholder="What should we build next? What's missing or broken?"
          maxLength={2000}
          rows={5}
          className="w-full resize-none rounded-lg text-sm text-[#F8FAFC] placeholder-[#475569] outline-none transition-colors"
          style={{
            backgroundColor: '#0A0A0F',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '12px 14px',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
          }}
        />

        <div className="flex items-center justify-between mt-2 mb-4">
          <span className="text-xs text-[#475569]">
            {message.trim().length < 10 && message.length > 0
              ? `${10 - message.trim().length} more characters needed`
              : ''}
          </span>
          <span
            className="text-xs tabular-nums"
            style={{ color: remaining < 100 ? '#F59E0B' : '#475569' }}
          >
            {remaining}
          </span>
        </div>

        {status === 'error' && (
          <p className="text-xs text-red-400 mb-3">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={status === 'submitting' || message.trim().length < 10}
          className="text-sm font-medium px-4 py-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#F59E0B',
          }}
          onMouseEnter={(e) => {
            if (!e.currentTarget.disabled) {
              e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.2)'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.12)'
          }}
        >
          {status === 'submitting' ? 'Sending…' : 'Send feedback'}
        </button>
      </form>
    </div>
  )
}
