import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const plans = [
  {
    name: "Free",
    price: "£0",
    period: "forever",
    desc: "For indie devs and side projects.",
    highlight: false,
    cta: "Get started",
    href: "/scan",
    features: [
      "5 scans per month",
      "Public repos only",
      "SAST & SCA scanning",
      "7-day report history",
      "Email notifications",
    ],
    missing: ["Private repos", "CI/CD integration", "API access", "SSO"],
  },
  {
    name: "Pro",
    price: "£29",
    period: "per month",
    desc: "For professional developers and small teams.",
    highlight: true,
    cta: "Start free trial",
    href: "/scan",
    features: [
      "Unlimited scans",
      "Public & private repos",
      "SAST, SCA, Secrets & DAST",
      "90-day report history",
      "Slack & webhook alerts",
      "GitHub Actions integration",
      "AI-powered fix suggestions",
      "Priority support",
    ],
    missing: ["SSO / SAML", "Custom policies"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "per seat",
    desc: "For teams that need compliance and control.",
    highlight: false,
    cta: "Contact us",
    href: "mailto:hello@vibetrace.dev",
    features: [
      "Everything in Pro",
      "SSO / SAML",
      "Custom security policies",
      "SOC2 & PCI-DSS reports",
      "On-prem deployment",
      "Dedicated SLA",
      "Custom integrations",
      "Training & onboarding",
    ],
    missing: [],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-50 bg-[#0A0A0F]/80 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#3B82F6] flex items-center justify-center">
            <span className="text-xs font-bold">VT</span>
          </div>
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
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20">
            Simple pricing
          </Badge>
          <h1 className="text-5xl font-bold mb-4">Transparent pricing</h1>
          <p className="text-white/40 text-lg max-w-xl mx-auto">
            Start free, scale as you grow. No hidden fees, no vendor lock-in.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col ${
                plan.highlight
                  ? "border-[#3B82F6]/40 bg-[#3B82F6]/5 glow-blue"
                  : "border-white/5 bg-white/[0.02]"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-[#3B82F6] text-white border-0">Most popular</Badge>
                </div>
              )}
              <CardHeader className="pb-4">
                <CardTitle className="text-white text-lg">{plan.name}</CardTitle>
                <CardDescription className="text-white/40 text-sm">{plan.desc}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-white/40 text-sm ml-2">/ {plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-6">
                <Button
                  className={`w-full ${
                    plan.highlight
                      ? "bg-[#3B82F6] hover:bg-[#2563EB] text-white"
                      : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                  }`}
                  asChild
                >
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
                <Separator className="bg-white/5" />
                <ul className="space-y-3 text-sm flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-white/70">
                      <span className="text-[#10B981] mt-0.5 shrink-0">✓</span>
                      {f}
                    </li>
                  ))}
                  {plan.missing.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-white/25">
                      <span className="mt-0.5 shrink-0">✕</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* FAQ teaser */}
        <div className="mt-20 text-center border-t border-white/5 pt-16">
          <h2 className="text-2xl font-bold mb-4">Questions?</h2>
          <p className="text-white/40 mb-6">
            We&apos;re happy to help. Reach out and we&apos;ll get back to you within 24 hours.
          </p>
          <Button variant="outline" className="border-white/10 text-white/60 hover:text-white hover:border-white/20 bg-transparent">
            Contact support
          </Button>
        </div>
      </div>
    </div>
  );
}
