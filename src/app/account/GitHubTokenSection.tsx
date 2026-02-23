'use client'

import { useState } from 'react'
import { Github, Check, AlertCircle, ExternalLink } from 'lucide-react'

interface Props {
  hasToken: boolean
  githubUsername: string | null
}

export function GitHubTokenSection({ hasToken, githubUsername }: Props) {
  const [pat, setPat] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSave() {
    if (!pat.trim()) return
    setSaving(true)
    setStatus('idle')
    try {
      const res = await fetch('/api/auth/save-github-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_token: pat.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('success')
        setPat('')
        // Reload to refresh shown username
        setTimeout(() => window.location.reload(), 1500)
      } else {
        setStatus('error')
        setErrorMsg(data.error ?? 'Invalid token')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Connection error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-white/10 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <Github className="w-5 h-5 text-white/60" />
        <div>
          <h3 className="font-semibold text-[#F8FAFC]">GitHub Access</h3>
          <p className="text-sm text-white/40">
            Required to scan private repositories
          </p>
        </div>
        {hasToken && (
          <span className="ml-auto flex items-center gap-1 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full">
            <Check className="w-3 h-3" />
            Connected{githubUsername ? ` as ${githubUsername}` : ''}
          </span>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm text-white/50">
          Create a GitHub{' '}
          <a
            href="https://github.com/settings/tokens/new?scopes=repo&description=VibeTrace"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
          >
            Personal Access Token <ExternalLink className="w-3 h-3" />
          </a>{' '}
          with <code className="bg-white/10 px-1 py-0.5 rounded text-xs">repo</code> scope,
          then paste it below. This gives VibeTrace access to your private repos for scanning.
        </p>

        <div className="flex gap-2">
          <input
            type="password"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            placeholder={hasToken ? 'Paste new token to update…' : 'ghp_xxxxxxxxxxxxxxxxxxxx'}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50"
          />
          <button
            onClick={handleSave}
            disabled={saving || !pat.trim()}
            className="px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm rounded-lg disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {saving ? 'Saving…' : 'Save Token'}
          </button>
        </div>

        {status === 'success' && (
          <p className="text-sm text-emerald-400 flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Token saved — private repos will now appear in scans
          </p>
        )}
        {status === 'error' && (
          <p className="text-sm text-red-400 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" /> {errorMsg}
          </p>
        )}
      </div>
    </div>
  )
}
