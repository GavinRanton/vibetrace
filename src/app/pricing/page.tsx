"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// Price IDs — read from NEXT_PUBLIC_ env vars at build time; fallback to known live IDs.
// To override without a rebuild, add NEXT_PUBLIC_STRIPE_*_PRICE to .env.local and rebuild.
const PRICE_IDS = {
  starterMonthly: process.env.NEXT_PUBLIC_STRIPE_STARTER_MONTHLY_PRICE ?? 'price_1T2c90FL8TcuJGVGSIgaHwDo',
  starterAnnual:  process.env.NEXT_PUBLIC_STRIPE_STARTER_ANNUAL_PRICE  ?? 'price_1T2c90FL8TcuJGVGYviA7xYd',
  proMonthly:     process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE     ?? 'price_1T2c91FL8TcuJGVGLfduO87r',
  proAnnual:      process.env.NEXT_PUBLIC_STRIPE_PRO_ANNUAL_PRICE      ?? 'price_1T2c92FL8TcuJGVGuMMfyzMl',
  deepAudit:      process.env.NEXT_PUBLIC_STRIPE_DEEP_AUDIT_PRICE      ?? 'price_1T2c92FL8TcuJGVGUUovUx4p',
};

const features = {
  free: [
    "1 scan",
    "3 vulnerability classes",
    "Public repos only",
  ],
  freeMissing: [
    "Fix prompts",
    "Security score",
    "Continuous monitoring",
    "PDF reports",
    "Security badge",
    "GDPR checklist",
  ],
  starter: [
    "Unlimited scans",
    "15+ vulnerability classes",
    "Fix prompts (AI-powered)",
    "Security score",
    "Public & private repos",
  ],
  starterMissing: [
    "Continuous monitoring",
    "PDF reports",
    "Security badge",
    "GDPR checklist",
  ],
  pro: [
    "Everything in Starter",
    "Continuous monitoring",
    "PDF security reports",
    "Security badge for README",
    "GDPR checklist",
    "Priority support",
  ],
};

async function startCheckout(priceId: string) {
  try {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      console.error("No checkout URL returned", data);
    }
  } catch (err) {
    console.error("Checkout error", err);
  }
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  const starterPrice = annual ? "£182" : "£19";
  const starterPeriod = annual ? "per year" : "per month";
  const starterNote = annual ? "Save 20% · £15.17/mo" : null;
  const starterPriceId = annual ? PRICE_IDS.starterAnnual : PRICE_IDS.starterMonthly;

  const proPrice = annual ? "£470" : "£49";
  const proPeriod = annual ? "per year" : "per month";
  const proNote = annual ? "Save 20% · £39.17/mo" : null;
  const proPriceId = annual ? PRICE_IDS.proAnnual : PRICE_IDS.proMonthly;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-50 bg-[#0A0A0F]/80 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <img src="/branding/logo-icon-dark.svg" alt="VibeTrace" className="w-7 h-7" />
          <span className="font-semibold">VibeTrace</span>
        </Link>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-white/50" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <Button size="sm" className="bg-[#3B82F6] hover:bg-[#2563EB] text-white" asChild>
            <Link href="/scan">Start scanning</Link>
          </Button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20">
            Simple pricing
          </Badge>
          <h1 className="text-5xl font-bold mb-4">Transparent pricing</h1>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            Start free, scale as you grow. No hidden fees, no vendor lock-in.
          </p>
        </div>

        {/* Monthly / Annual toggle — single flex row */}
        <div className="flex flex-row items-center justify-center gap-3 mb-12">
          <span className={`text-sm ${!annual ? "text-white" : "text-white/40"}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative flex h-6 w-12 items-center rounded-full transition-colors duration-200 ${annual ? "bg-[#3B82F6]" : "bg-white/20"}`}
            aria-label="Toggle annual billing"
            data-testid="pricing-toggle"
            role="switch"
            aria-checked={annual}
          >
            <span
              className={`h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-200 ${annual ? "ml-7" : "ml-1"}`}
            />
          </button>
          <span className={`text-sm ${annual ? "text-white" : "text-white/40"}`}>Annual</span>
          <Badge className="text-xs bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20 whitespace-nowrap">
            Save 20%
          </Badge>
        </div>

        {/* Main 3-column grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Free */}
          <Card className="relative flex flex-col border-white/5 bg-white/[0.02]">
            <CardHeader className="pb-4">
              <CardTitle className="text-white text-lg">Free</CardTitle>
              <CardDescription className="text-white/40 text-sm">For indie devs and side projects.</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-white">£0</span>
                <span className="text-white/40 text-sm ml-2">/ forever</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-6">
              <Button
                className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10"
                asChild
              >
                <Link href="/signup">Get started</Link>
              </Button>
              <Separator className="bg-white/5" />
              <ul className="space-y-3 text-sm flex-1">
                {features.free.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-white/70">
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: "#10B981" }} />
                    {f}
                  </li>
                ))}
                {features.freeMissing.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-white/25">
                    <X size={16} className="mt-0.5 shrink-0" style={{ color: "#94A3B8" }} />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Starter */}
          <Card className="relative flex flex-col border-white/5 bg-white/[0.02]">
            <CardHeader className="pb-4">
              <CardTitle className="text-white text-lg">Starter</CardTitle>
              <CardDescription className="text-white/40 text-sm">For developers who scan regularly.</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-white" data-testid="price-starter">{starterPrice}</span>
                <span className="text-white/40 text-sm ml-2">/ {starterPeriod}</span>
                {starterNote && (
                  <p className="text-[#10B981] text-xs mt-1">{starterNote}</p>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-6">
              <Button
                className="w-full bg-white/5 hover:bg-white/10 text-white border border-white/10"
                onClick={() => startCheckout(starterPriceId)}
              >
                Get Starter
              </Button>
              <Separator className="bg-white/5" />
              <ul className="space-y-3 text-sm flex-1">
                {features.starter.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-white/70">
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: "#10B981" }} />
                    {f}
                  </li>
                ))}
                {features.starterMissing.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-white/25">
                    <X size={16} className="mt-0.5 shrink-0" style={{ color: "#94A3B8" }} />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Pro */}
          <Card className="relative flex flex-col border-[#3B82F6]/40 bg-[#3B82F6]/5">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-[#3B82F6] text-white border-0">Most popular</Badge>
            </div>
            <CardHeader className="pb-4">
              <CardTitle className="text-white text-lg">Pro</CardTitle>
              <CardDescription className="text-white/40 text-sm">For teams that need full coverage.</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold text-white" data-testid="price-pro">{proPrice}</span>
                <span className="text-white/40 text-sm ml-2">/ {proPeriod}</span>
                {proNote && (
                  <p className="text-[#10B981] text-xs mt-1">{proNote}</p>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-6">
              <Button
                className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                onClick={() => startCheckout(proPriceId)}
              >
                Get Pro
              </Button>
              <Separator className="bg-white/5" />
              <ul className="space-y-3 text-sm flex-1">
                {features.pro.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-white/70">
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: "#10B981" }} />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Deep Audit — one-time card */}
        <div className="mt-10">
          <Card className="border-[#8B5CF6]/30 bg-[#8B5CF6]/5 flex flex-col md:flex-row items-center justify-between gap-6 p-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-[#8B5CF6]">DA</span>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-white font-semibold text-lg">Deep Audit</h3>
                  <Badge className="bg-[#8B5CF6]/20 text-[#8B5CF6] border-[#8B5CF6]/30 text-xs">One-time</Badge>
                </div>
                <p className="text-white/50 text-sm max-w-lg">
                  A thorough, human-reviewed security audit of your repository. Includes a full vulnerability report,
                  remediation roadmap, and a 30-minute call to walk through findings.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <p className="text-3xl font-bold text-white">£79</p>
                <p className="text-white/40 text-xs">one-time payment</p>
              </div>
              <Button
                className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white whitespace-nowrap"
                onClick={() => startCheckout(PRICE_IDS.deepAudit)}
              >
                Get Deep Audit
              </Button>
            </div>
          </Card>
        </div>

        {/* Questions section */}
        <div className="mt-20 text-center border-t border-white/5 pt-16">
          <h2 className="text-2xl font-bold mb-4">Questions?</h2>
          <p className="text-white/40 mb-6">
            We&apos;re happy to help. Reach out and we&apos;ll get back to you within 24 hours.
          </p>
          <a
            href="mailto:support@vibetrace.app"
            className="inline-flex items-center justify-center rounded-md border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white hover:border-white/20 transition-colors bg-transparent"
          >
            Contact support
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 text-center text-[#94A3B8] text-sm">
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <span>© 2026 VibeTrace</span>
          <Link href="/terms" className="text-white/30 hover:text-white/60 text-sm transition-colors">Terms</Link>
          <Link href="/privacy" className="text-white/30 hover:text-white/60 text-sm transition-colors">Privacy</Link>
        </div>
      </footer>
    </div>
  );
}
