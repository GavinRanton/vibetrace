'use client'

import { useState } from 'react'
import { LogOut, Download, Trash2, CreditCard } from 'lucide-react'

interface Props {
  section: 'subscription' | 'data'
}

export function AccountActions({ section }: Props) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteInput, setDeleteInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)

  async function handleManageSubscription() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } finally {
      setPortalLoading(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteInput !== 'DELETE') return
    setDeleting(true)
    try {
      await fetch('/api/account/delete', { method: 'DELETE' })
      window.location.href = '/'
    } finally {
      setDeleting(false)
    }
  }

  if (section === 'subscription') {
    return (
      <button
        onClick={handleManageSubscription}
        disabled={portalLoading}
        className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-white/10 text-[#F8FAFC] hover:bg-white/5 transition-colors disabled:opacity-50"
      >
        <CreditCard className="w-4 h-4" />
        {portalLoading ? 'Loading...' : 'Manage subscription'}
      </button>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <a
          href="/api/account/export"
          download
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-white/10 text-[#F8FAFC] hover:bg-white/5 transition-colors w-fit"
        >
          <Download className="w-4 h-4" />
          Export my data
        </a>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors w-fit"
        >
          <Trash2 className="w-4 h-4" />
          Delete my account
        </button>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => { setShowDeleteModal(false); setDeleteInput('') }}
          />
          <div className="relative z-10 bg-[#1E1E2E] border border-white/10 rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <h2 className="text-lg font-semibold text-[#F8FAFC] mb-2">Delete account</h2>
            <p className="text-sm text-[#94A3B8] mb-4">
              This action is permanent and cannot be undone. All your scans and data will be deleted.
            </p>
            <p className="text-sm text-[#F8FAFC] mb-3">
              Type <span className="font-mono font-bold text-red-400">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-[#F8FAFC] placeholder:text-[#94A3B8]/50 focus:outline-none focus:border-red-500/50 mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteInput('') }}
                className="px-4 py-2 text-sm text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteInput !== 'DELETE' || deleting}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
