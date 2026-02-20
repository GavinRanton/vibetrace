"use client";

import { useState } from "react";
import Link from "next/link";
import { Github, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface AuthCardProps {
  mode: "login" | "signup";
}

export function AuthCard({ mode }: AuthCardProps) {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  const heading =
    mode === "login" ? "Sign in to VibeTrace" : "Get started with VibeTrace";
  const submitLabel = mode === "login" ? "Sign in" : "Sign up";

  function validate(): boolean {
    let valid = true;
    setEmailError("");
    setPasswordError("");
    setAuthError("");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address.");
      valid = false;
    }
    if (!password || password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      valid = false;
    }
    return valid;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setAuthError("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setAuthError(error.message);
        } else {
          router.push("/dashboard");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setAuthError("Invalid email or password.");
        } else {
          router.push("/dashboard");
        }
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
          <div className="w-10 h-10 rounded-xl bg-[#3B82F6] flex items-center justify-center">
            <span className="font-bold text-white text-sm">VT</span>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-[#F8FAFC] text-xl font-semibold text-center">
          {heading}
        </h1>

        {/* GitHub Button */}
        <button
          type="button"
          onClick={() => (window.location.href = "/api/auth/github")}
          className="flex items-center justify-center gap-2 h-11 w-full rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold text-sm transition-colors"
        >
          <Github size={24} />
          Continue with GitHub
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <hr className="flex-1 border-white/10" />
          <span className="text-[#94A3B8] text-xs">or</span>
          <hr className="flex-1 border-white/10" />
        </div>

        {/* Google Button */}
        <button
          type="button"
          onClick={() => (window.location.href = "/api/auth/google")}
          className="bg-white text-gray-900 border border-gray-200 h-11 w-full rounded-lg font-semibold text-sm flex items-center justify-center gap-3 hover:bg-gray-50 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.566 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          {/* Auth Error */}
          {authError && (
            <p className="text-red-400 text-xs text-center">{authError}</p>
          )}

          {/* Email */}
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

          {/* Password */}
          <div className="flex flex-col gap-1">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-lg bg-[#0A0A0F] border border-white/10 text-white placeholder:text-white/30 px-4 pr-11 text-sm outline-none focus:border-[#3B82F6] transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {passwordError && (
              <p className="text-red-400 text-xs">{passwordError}</p>
            )}
            {/* Forgot password — login only */}
            {mode === "login" && (
              <div className="text-right">
                <Link
                  href="/forgot-password"
                  className="text-[#94A3B8] hover:text-white text-xs transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="h-11 w-full rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-semibold text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "Please wait..." : submitLabel}
          </button>
        </form>

        {/* Footer links */}
        <p className="text-[#94A3B8] text-xs text-center">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="text-[#3B82F6] hover:underline font-medium"
              >
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-[#3B82F6] hover:underline font-medium"
              >
                Sign in
              </Link>
            </>
          )}
        </p>

        {/* Disclaimer */}
        <p className="text-[#94A3B8] text-xs text-center mt-4">
          Read-only GitHub access. We scan and delete your code. We never store
          it.
        </p>
      </div>
    </div>
  );
}
