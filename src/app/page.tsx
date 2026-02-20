"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Shield,
  Package,
  Wand2,
  GitBranch,
  Bell,
  FileCheck,
  Github,
  ScanLine,
  ChevronDown,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ── Features ──────────────────────────────────────────────────────────────────
const features: {
  title: string;
  desc: string;
  color: string;
  Icon: LucideIcon;
  comingSoon?: boolean;
}[] = [
  {
    title: "SAST Analysis",
    desc: "Automatically reads your code and flags dangerous patterns — like leaving a door unlocked — before your app goes live.",
    color: "#3B82F6",
    Icon: Shield,
  },
  {
    title: "Dependency Scanning",
    desc: "Checks every third-party package your app relies on. If one has a known security flaw, we tell you which one and how to fix it.",
    color: "#10B981",
    Icon: Package,
  },
  {
    title: "AI Remediation",
    desc: "Get a plain-English explanation of every issue, plus a ready-to-paste fix prompt for Lovable or Cursor.",
    color: "#F59E0B",
    Icon: Wand2,
  },
  {
    title: "CI/CD Integration",
    desc: "Automatically scan every time you push code. Catch issues before they reach your users.",
    color: "#3B82F6",
    Icon: GitBranch,
    comingSoon: true,
  },
  {
    title: "Real-time Alerts",
    desc: "Get notified by email the moment a new vulnerability is found that affects your app.",
    color: "#EF4444",
    Icon: Bell,
    comingSoon: true,
  },
  {
    title: "Compliance Reports",
    desc: "One-click reports showing which security standards your app meets — useful when investors or clients ask.",
    color: "#10B981",
    Icon: FileCheck,
    comingSoon: true,
  },
];

// ── Steps ─────────────────────────────────────────────────────────────────────
const steps: { label: string; Icon: LucideIcon; detail: string }[] = [
  {
    label: "Connect GitHub",
    Icon: Github,
    detail: "Read-only access. We never write to your repo.",
  },
  {
    label: "Run scan",
    Icon: ScanLine,
    detail: "Full scan completes in under 60 seconds.",
  },
  {
    label: "Get fix prompts",
    Icon: Wand2,
    detail: "Paste straight into Lovable or Cursor.",
  },
];

// ── FAQ ───────────────────────────────────────────────────────────────────────
const faqs: { q: string; a: string }[] = [
  {
    q: "What does VibeTrace scan for?",
    a: "SQL injection, cross-site scripting (XSS), authentication issues, exposed secrets, dependency vulnerabilities, and 100+ other security patterns.",
  },
  {
    q: "Do you store my code?",
    a: "No. We clone your repository, scan it, and delete it immediately. Your code is never stored on our servers.",
  },
  {
    q: "What's a fix prompt?",
    a: "A ready-to-paste instruction you drop into Lovable or Cursor to fix the vulnerability. No coding knowledge needed.",
  },
  {
    q: "Can I scan a live website?",
    a: "Yes. Our URL scanner checks your deployed site for common issues like missing security headers, exposed endpoints, and configuration problems.",
  },
  {
    q: "Is the free plan really free?",
    a: "Yes. One scan, no credit card required. Upgrade when you need more.",
  },
  {
    q: "How is this different from Snyk?",
    a: "Snyk is built for developers. VibeTrace is built for founders who don't code. Plain English explanations and fix prompts — not CVE numbers.",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F8FAFC]">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-50 bg-[#0A0A0F]/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#3B82F6] flex items-center justify-center">
            <span className="text-xs font-bold text-white">VT</span>
          </div>
          <span className="font-semibold text-[#F8FAFC]">VibeTrace</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-[#94A3B8]">
          <Link href="#features" className="hover:text-[#F8FAFC] transition-colors">Features</Link>
          <Link href="/pricing" className="hover:text-[#F8FAFC] transition-colors">Pricing</Link>
          <Link href="#faq" className="hover:text-[#F8FAFC] transition-colors">FAQ</Link>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-[#94A3B8] hover:text-[#F8FAFC]" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="sm" className="bg-[#3B82F6] hover:bg-[#2563EB] text-white" asChild>
            <Link href="/signup">Scan your app free →</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-24 pb-20 max-w-5xl mx-auto text-center">
        <Badge className="mb-6 bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20 hover:bg-[#3B82F6]/20">
          Built for Lovable, Bolt &amp; Cursor apps
        </Badge>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
          Security for the<br />
          <span className="text-[#3B82F6]">vibe coding era</span>
        </h1>
        <p className="text-xl text-[#94A3B8] max-w-2xl mx-auto mb-10 leading-relaxed">
          Security scanning for apps built with AI. Find vulnerabilities. Get fix prompts you can paste straight into Lovable or Cursor.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-8" asChild>
            <Link href="/signup">Scan your app free →</Link>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white/10 text-[#94A3B8] hover:text-[#F8FAFC] hover:border-white/20 bg-transparent"
            asChild
          >
            <Link href="/pricing">See pricing →</Link>
          </Button>
        </div>

        {/* Trust signals */}
        <div className="mt-10 flex flex-wrap gap-3 justify-center">
          {["Read-only GitHub access", "Code never stored", "Scan and delete"].map((signal) => (
            <span
              key={signal}
              className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] border border-white/10 rounded-full px-3 py-1 bg-white/[0.02]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
              {signal}
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">How it works</h2>
          <p className="text-[#94A3B8]">Up and running in under two minutes.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {steps.map((step, i) => (
            <div
              key={step.label}
              className="flex flex-col gap-4 rounded-xl border border-white/5 bg-[#1E1E2E] p-6"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-[#3B82F6]">{i + 1}</span>
                <step.Icon size={24} strokeWidth={1.5} className="text-[#F8FAFC]" />
              </div>
              <div>
                <p className="font-semibold text-[#F8FAFC] mb-1">{step.label}</p>
                <p className="text-sm text-[#94A3B8]">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Everything you need</h2>
          <p className="text-[#94A3B8]">Built for founders, not just developers.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="bg-[#1E1E2E] border-white/5 hover:border-white/10 transition-colors relative"
            >
              <CardHeader>
                <div className="mb-2 flex items-center justify-between">
                  <feature.Icon size={24} strokeWidth={1.5} style={{ color: feature.color }} />
                  {feature.comingSoon && (
                    <span className="text-[10px] font-medium text-[#94A3B8] border border-white/10 rounded-full px-2 py-0.5">
                      Coming soon
                    </span>
                  )}
                </div>
                <CardTitle className="text-[#F8FAFC] text-base">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-[#94A3B8] text-sm leading-relaxed">
                  {feature.desc}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 py-20 max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Frequently asked questions</h2>
        </div>
        <div className="flex flex-col gap-3">
          {faqs.map((faq, i) => {
            const isOpen = openFaq === i;
            return (
              <div
                key={i}
                className="rounded-xl border border-white/5 bg-[#1E1E2E] overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left"
                >
                  <span className="font-medium text-[#F8FAFC] text-sm">{faq.q}</span>
                  <ChevronDown
                    size={18}
                    strokeWidth={1.5}
                    className={`text-[#94A3B8] transition-transform duration-200 flex-shrink-0 ml-4 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-6 pb-4 text-sm text-[#94A3B8] leading-relaxed border-t border-white/5 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 max-w-3xl mx-auto text-center">
        <div className="border border-[#3B82F6]/20 rounded-2xl p-12 bg-[#3B82F6]/5">
          <h2 className="text-3xl font-bold mb-4">Start scanning today</h2>
          <p className="text-[#94A3B8] mb-8">One free scan. No credit card required.</p>
          <Button size="lg" className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-10" asChild>
            <Link href="/signup">Scan your app free →</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 text-center text-[#94A3B8] text-sm">
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <span>© 2026 VibeTrace. Security for the vibe coding era.</span>
          <Link href="/terms" className="text-white/30 hover:text-white/60 text-sm transition-colors">Terms</Link>
          <Link href="/privacy" className="text-white/30 hover:text-white/60 text-sm transition-colors">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
