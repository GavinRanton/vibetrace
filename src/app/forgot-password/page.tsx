"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    setError("");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo: "https://vibetrace.app/auth/callback" }
      );
      if (resetError) {
        setError(resetError.message);
      } else {
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#1E1E2E] rounded-2xl p-8 flex flex-col gap-6">
        {/* Logo */}
        <div className="flex justify-center">
          <img src="/branding/logo-icon-white.svg" alt="VibeTrace" className="w-10 h-10" />
        </div>

        <h1 className="text-[#F8FAFC] text-xl font-semibold text-center">
          Reset your password
        </h1>

        {sent ? (
          <div className="text-center flex flex-col gap-4">
            <p className="text-[#94A3B8] text-sm">
              Check your email for a reset link.
            </p>
            <Link
              href="/login"
              className="text-[#3B82F6] hover:underline text-sm font-medium"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            {error && (
              <p className="text-red-400 text-xs text-center">{error}</p>
            )}

            <div className="flex flex-col gap-1">
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-lg bg-[#0A0A0F] border border-white/10 text-white placeholder:text-white/30 px-4 text-sm outline-none focus:border-[#3B82F6] transition-colors"
              />
              {emailError && (
                <p className="text-red-400 text-xs">{emailError}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>

            <p className="text-center">
              <Link
                href="/login"
                className="text-[#94A3B8] hover:text-white text-xs transition-colors"
              >
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
