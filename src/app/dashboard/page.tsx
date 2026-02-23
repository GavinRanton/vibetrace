'use client'

import { Suspense, useState, useEffect } from 'react';
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/app-sidebar";
import { ChevronUp, ChevronDown, ShieldCheck, Menu, Copy, Check, PackageX } from "lucide-react";

type Finding = {
  id: string;
  severity: string;
  category: string;
  file_path: string;
  rule_id?: string | null;
  line_number?: number | null;
  plain_english: string;
  actual_error?: string | null;
  fix_prompt?: string | null;
  verification_step?: string | null;
  status: string;
  created_at: string;
};

type DashboardData = {
  plan: string;
  scan_count: number;
  scans_limit: number;
  findings: Finding[];
  severity_counts: { critical: number; high: number; medium: number; low: number };
  last_scan_at: string | null;
  user_email: string | null;
};

const SEV: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "#EF4444", bg: "rgba(239,68,68,0.1)",  label: "Critical" },
  high:     { color: "#F59E0B", bg: "rgba(245,158,11,0.1)", label: "High"     },
  medium:   { color: "#3B82F6", bg: "rgba(59,130,246,0.1)", label: "Medium"   },
  low:      { color: "#10B981", bg: "rgba(16,185,129,0.1)", label: "Low"      },
};

function stripPath(p: string) {
  return p.replace(/^.*vibetrace-scan-[^/]+\//, '');
}

function FixDrawer({ finding }: { finding: Finding }) {
  const [copied, setCopied] = useState(false);
  const cfg = SEV[finding.severity] ?? SEV.low;
  const loc = finding.file_path
    ? stripPath(finding.file_path) + (finding.line_number ? ':' + finding.line_number : '')
    : null;

  function copy() {
    navigator.clipboard.writeText(finding.fix_prompt ?? '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost" className="text-[#3B82F6] hover:text-[#60A5FA] h-7 text-xs px-2">
          Fix →
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[500px] bg-[#0D0D14] border-white/10 overflow-y-auto flex flex-col gap-0">
        <SheetHeader className="mb-6 shrink-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <Badge style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
              {cfg.label}
            </Badge>
            {loc && <span className="text-white/40 font-mono text-xs">{loc}</span>}
          </div>
          <SheetTitle className="text-white text-left text-base leading-snug">
            {finding.rule_id || 'Security vulnerability detected'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6 overflow-y-auto">
          <div>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Actual error</h3>
            <pre className="bg-white/[0.04] border border-white/10 rounded-md p-4 text-xs text-white/70 font-mono whitespace-pre-wrap break-words leading-relaxed">
              {finding.actual_error || 'Raw scanner output unavailable for this finding.'}
            </pre>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Plain-English explanation</h3>
            <p className="text-sm text-white/80 leading-relaxed">{finding.plain_english}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Fix Prompt</h3>
              <Button
                size="sm" variant="ghost" onClick={copy}
                className="h-7 text-xs text-white/50 hover:text-white gap-1.5"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            {finding.fix_prompt ? (
              <pre className="bg-white/[0.04] border border-white/10 rounded-md p-4 text-xs text-white/80 font-mono whitespace-pre-wrap break-words leading-relaxed">
                {finding.fix_prompt}
              </pre>
            ) : (
              <p className="text-white/30 text-sm italic">
                Fix prompt not available — run a new scan to generate updated prompts.
              </p>
            )}
          </div>

          {finding.verification_step && (
            <div>
              <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                How to verify
              </h3>
              <p className="text-sm text-white/70 leading-relaxed">{finding.verification_step}</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SortIcon() {
  return (
    <span className="inline-flex flex-col opacity-30 ml-1">
      <ChevronUp className="w-3 h-3 -mb-1" />
      <ChevronDown className="w-3 h-3" />
    </span>
  );
}

function IssuesTable({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return null;
  return (
    <Card className="bg-white/[0.02] border-white/5 overflow-hidden">
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-white/5 text-white/40">
              <th className="text-left px-5 py-3 font-medium w-24">Severity<SortIcon /></th>
              <th className="text-left px-5 py-3 font-medium">Issue<SortIcon /></th>
              <th className="text-left px-5 py-3 font-medium w-44">Location<SortIcon /></th>
              <th className="text-left px-5 py-3 font-medium w-28">Discovered<SortIcon /></th>
              <th className="text-left px-5 py-3 font-medium w-20">Action</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((f) => {
              const cfg = SEV[f.severity] ?? SEV.low;
              const loc = f.file_path
                ? stripPath(f.file_path) + (f.line_number ? ':' + f.line_number : '')
                : '—';
              return (
                <tr key={f.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors last:border-0">
                  <td className="px-5 py-4">
                    <Badge style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                      {cfg.label}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-white/80">{f.plain_english}</td>
                  <td className="px-5 py-4 text-white/70 font-mono text-xs truncate max-w-[176px]">{loc}</td>
                  <td className="px-5 py-4 text-white/60 text-xs whitespace-nowrap">
                    {new Date(f.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-5 py-4">
                    <FixDrawer finding={f} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function EmptyNoScans() {
  return (
    <Card className="bg-white/[0.02] border-white/5">
      <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
        <ShieldCheck className="w-12 h-12 text-[#3B82F6]" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-1">No scans yet</h3>
          <p className="text-white/40 text-sm">Run your first scan to see security findings.</p>
        </div>
        <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white mt-2" asChild>
          <Link href="/scan">New Scan</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function EmptyClean() {
  return (
    <Card className="bg-white/[0.02] border-white/5">
      <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
        <ShieldCheck className="w-12 h-12 text-[#10B981]" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-1">All clear</h3>
          <p className="text-white/40 text-sm">Your last scan found no vulnerabilities.</p>
        </div>
        <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white mt-2" asChild>
          <Link href="/scan">Run Another Scan</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CheckoutBanner() {
  const sp = useSearchParams();
  if (sp.get('checkout') !== 'success') return null;
  return (
    <div className="w-full bg-green-600 text-white text-center py-3 px-4 text-sm font-medium">
      🎉 Payment successful! Your plan has been upgraded.
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  // Capture GitHub provider_token immediately after login and persist it to DB
  // (provider_token is only available client-side and disappears after session refresh)
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.provider_token;
      if (token) {
        fetch('/api/auth/save-github-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ github_token: token }),
        }).catch(() => {});
      }
    });
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
      <div className="text-white/40">Loading…</div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
      <div className="text-white/40">Failed to load dashboard</div>
    </div>
  );

  const sidebarProps = {
    activePath: '/dashboard',
    userEmail: data.user_email,
    plan: data.plan,
    scanCount: data.scan_count,
    scansLimit: data.scans_limit,
  };

  const criticalFindings   = data.findings.filter(f => f.severity === 'critical');
  const dependencyFindings = data.findings.filter(f => f.category === 'dependency');

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <Suspense fallback={null}><CheckoutBanner /></Suspense>
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-56 md:fixed md:inset-y-0 border-r border-white/5 flex-col p-4 shrink-0">
          <AppSidebar {...sidebarProps} />
        </aside>

        <div className="md:ml-56 flex-1 flex flex-col min-h-screen">
          {/* Mobile top bar */}
          <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0A0A0F] sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <img src="/branding/logo-icon-dark.svg" alt="VibeTrace" className="w-6 h-6" />
              <span className="font-semibold text-sm">VibeTrace</span>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white/60">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-56 bg-[#0A0A0F] border-white/5 p-4 flex flex-col">
                <AppSidebar {...sidebarProps} />
              </SheetContent>
            </Sheet>
          </div>

          <main className="flex-1 p-4 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold">Security Overview</h1>
                <p className="text-white/40 text-sm mt-1">
                  {data.last_scan_at
                    ? `Last scan: ${new Date(data.last_scan_at).toLocaleDateString('en-GB')}`
                    : 'No scans yet'}
                </p>
              </div>
              <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white" asChild>
                <Link href="/scan">+ New Scan</Link>
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { ...SEV.critical, value: data.severity_counts.critical },
                { ...SEV.high,     value: data.severity_counts.high     },
                { ...SEV.medium,   value: data.severity_counts.medium   },
                { ...SEV.low,      value: data.severity_counts.low      },
              ].map((s) => (
                <Card key={s.label} className="bg-white/[0.02] border-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-white/40 uppercase tracking-wider">{s.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Tabs */}
            <Tabs defaultValue="all">
              <TabsList className="bg-white/5 border border-white/10 mb-6">
                <TabsTrigger value="all" className="data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white">
                  All Issues {data.findings.length > 0 && `(${data.findings.length})`}
                </TabsTrigger>
                <TabsTrigger value="critical" className="data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white">
                  Critical {criticalFindings.length > 0 && `(${criticalFindings.length})`}
                </TabsTrigger>
                <TabsTrigger value="dependencies" className="data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white">
                  Dependencies
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all">
                {data.findings.length === 0
                  ? (data.last_scan_at ? <EmptyClean /> : <EmptyNoScans />)
                  : <IssuesTable findings={data.findings} />}
              </TabsContent>
              <TabsContent value="critical">
                {criticalFindings.length === 0
                  ? <div className="text-white/40 text-center py-8">No critical issues.</div>
                  : <IssuesTable findings={criticalFindings} />}
              </TabsContent>
              <TabsContent value="dependencies">
                {dependencyFindings.length === 0 ? (
                  <Card className="bg-white/[0.02] border-white/5">
                    <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                      <PackageX className="w-12 h-12 text-white/20" />
                      <div className="text-center">
                        <h3 className="text-lg font-semibold text-white mb-1">No dependency data</h3>
                        <p className="text-white/40 text-sm max-w-xs">
                          Dependency (SCA) scanning analyses your package.json for known CVEs. Coming soon.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <IssuesTable findings={dependencyFindings} />
                )}
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </div>
  );
}
