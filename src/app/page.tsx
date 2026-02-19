import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-50 bg-[#0A0A0F]/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#3B82F6] flex items-center justify-center">
            <span className="text-xs font-bold text-white">VT</span>
          </div>
          <span className="font-semibold text-white">VibeTrace</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
          <Link href="#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/scan" className="hover:text-white transition-colors">Try Scanner</Link>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="text-white/70 hover:text-white" asChild>
            <Link href="/dashboard">Sign in</Link>
          </Button>
          <Button size="sm" className="bg-[#3B82F6] hover:bg-[#2563EB] text-white" asChild>
            <Link href="/scan">Start scanning →</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-24 pb-20 max-w-5xl mx-auto text-center">
        <Badge className="mb-6 bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20 hover:bg-[#3B82F6]/20">
          Now in beta · Free tier available
        </Badge>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-tight">
          Security scanning
          <br />
          <span className="gradient-text">done right</span>
        </h1>
        <p className="text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed">
          Enterprise-grade vulnerability scanning powered by AI. Find and fix critical security
          issues in your code, dependencies, and infrastructure before they reach production.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="bg-[#3B82F6] hover:bg-[#2563EB] text-white glow-blue px-8" asChild>
            <Link href="/scan">Scan your repo →</Link>
          </Button>
          <Button size="lg" variant="outline" className="border-white/10 text-white/70 hover:text-white hover:border-white/20 bg-transparent" asChild>
            <Link href="/dashboard">View demo dashboard</Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-3 gap-8 border border-white/5 rounded-xl p-8 bg-white/[0.02]">
          {[
            { value: "10k+", label: "Scans completed" },
            { value: "99.2%", label: "Accuracy rate" },
            { value: "< 60s", label: "Average scan time" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-[#3B82F6]">{stat.value}</div>
              <div className="text-sm text-white/40 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 py-20 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-3">Everything you need</h2>
          <p className="text-white/40">Comprehensive security coverage across your entire stack.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              title: "SAST Analysis",
              desc: "Static code analysis detecting SQL injection, XSS, and 100+ vulnerability patterns.",
              color: "#3B82F6",
              icon: "⚡",
            },
            {
              title: "Dependency Scanning",
              desc: "CVE detection across npm, pip, cargo, and more. Updated in real-time.",
              color: "#10B981",
              icon: "📦",
            },
            {
              title: "AI Remediation",
              desc: "One-click fixes powered by AI. Understand the vulnerability and patch it instantly.",
              color: "#F59E0B",
              icon: "🤖",
            },
            {
              title: "CI/CD Integration",
              desc: "Native GitHub Actions, GitLab CI, and Jenkins plugins. Shift left effortlessly.",
              color: "#3B82F6",
              icon: "🔄",
            },
            {
              title: "Real-time Alerts",
              desc: "Instant Slack, email, and webhook notifications when new CVEs affect your stack.",
              color: "#EF4444",
              icon: "🔔",
            },
            {
              title: "Compliance Reports",
              desc: "SOC2, PCI-DSS, and OWASP Top 10 reports generated automatically.",
              color: "#10B981",
              icon: "📋",
            },
          ].map((feature) => (
            <Card key={feature.title} className="bg-white/[0.02] border-white/5 hover:border-white/10 transition-colors">
              <CardHeader>
                <div className="text-2xl mb-2">{feature.icon}</div>
                <CardTitle className="text-white text-base">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-white/40 text-sm leading-relaxed">
                  {feature.desc}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 max-w-3xl mx-auto text-center">
        <div className="border border-[#3B82F6]/20 rounded-2xl p-12 bg-[#3B82F6]/5">
          <h2 className="text-3xl font-bold mb-4">Start scanning today</h2>
          <p className="text-white/40 mb-8">Free tier includes 5 scans/month. No credit card required.</p>
          <Button size="lg" className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-10" asChild>
            <Link href="/scan">Get started free →</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 text-center text-white/30 text-sm">
        © 2026 VibeTrace. Built for developers who ship.
      </footer>
    </div>
  );
}
