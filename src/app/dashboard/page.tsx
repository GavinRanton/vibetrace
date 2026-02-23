'use client'

import { Suspense, useState, useEffect } from 'react';
import Link from "next/link";
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ChevronUp, ChevronDown, ShieldCheck, User, LogOut, Menu } from "lucide-react";

type Finding = {
  id: string;
  severity: string;
  category: string;
  file_path: string;
  plain_english: string;
  fix_prompt: string;
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
};

const severityConfig: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "#EF4444", bg: "rgba(239,68,68,0.1)", label: "Critical" },
  high:     { color: "#F59E0B", bg: "rgba(245,158,11,0.1)", label: "High" },
  medium:   { color: "#3B82F6", bg: "rgba(59,130,246,0.1)", label: "Medium" },
  low:      { color: "#10B981", bg: "rgba(16,185,129,0.1)", label: "Low" },
};

function SortHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      {children}
      <span className="flex flex-col opacity-30">
        <ChevronUp className="w-3 h-3 -mb-1" />
        <ChevronDown className="w-3 h-3" />
      </span>
    </div>
  );
}

function handleSignOut() {
  fetch('/api/auth/logout', { method: 'POST' }).then(() => {
    window.location.href = '/'
  })
}

function IssuesTable({ findings }: { findings: Finding[] }) {
  return (
    <Card className="bg-white/[0.02] border-white/5">
      <CardContent className="p-0">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[100px]" />
            <col className="w-auto" style={{ minWidth: "250px" }} />
            <col className="w-[200px]" />
            <col className="w-[140px]" />
            <col className="w-[120px]" />
            <col className="w-[80px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-white/5 text-white/40">
              <th className="text-left px-6 py-3 font-medium w-[100px]">
                <SortHeader>Severity</SortHeader>
              </th>
              <th className="text-left px-6 py-3 font-medium" style={{ minWidth: "250px" }}>
                <SortHeader>Issue</SortHeader>
              </th>
              <th className="text-left px-6 py-3 font-medium w-[200px]">
                <SortHeader>Location</SortHeader>
              </th>
              <th className="text-left px-6 py-3 font-medium w-[140px]">
                <SortHeader>CVE</SortHeader>
              </th>
              <th className="text-left px-6 py-3 font-medium w-[120px]">
                <SortHeader>Discovered</SortHeader>
              </th>
              <th className="text-left px-6 py-3 font-medium w-[80px]">Action</th>
            </tr>
          </thead>
          <tbody>
            {findings.map((issue) => {
              const cfg = severityConfig[issue.severity] ?? severityConfig['low'];
              return (
                <tr key={issue.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                  <td className="px-6 py-4 w-[100px]">
                    <Badge
                      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}
                    >
                      {cfg.label}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-white/80 font-medium" style={{ minWidth: "250px" }}>
                    <span className="inline-flex items-center gap-1 flex-wrap">
                      {issue.plain_english}
                      {issue.category === 'dast' && (
                        <span className="ml-1 text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">DAST</span>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-white/40 font-mono text-xs w-[200px] truncate overflow-hidden max-w-[200px]">{issue.file_path}</td>
                  <td className="px-6 py-4 w-[140px] whitespace-nowrap">
                    <span className="text-white/20 text-xs">—</span>
                  </td>
                  <td className="px-6 py-4 w-[120px] text-white/40 text-xs whitespace-nowrap">
                    {new Date(issue.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 w-[80px]">
                    <Button size="sm" variant="ghost" className="text-[#3B82F6] hover:text-[#60A5FA] h-7 text-xs">
                      Fix →
                    </Button>
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

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="bg-white/[0.02] border-white/5">
      <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
        <ShieldCheck className="w-12 h-12 text-[#10B981]" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-1">No scans yet</h3>
          <p className="text-white/40 text-sm">{message}</p>
        </div>
        <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white mt-2" asChild>
          <Link href="/scan">New Scan</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CleanState() {
  return (
    <Card className="bg-white/[0.02] border-white/5">
      <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
        <ShieldCheck className="w-12 h-12 text-[#10B981]" />
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white mb-1">Latest scan clean</h3>
          <p className="text-white/40 text-sm">Score 100 — No vulnerabilities detected</p>
        </div>
        <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white mt-2" asChild>
          <Link href="/scan">Run Another Scan</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CheckoutBanner() {
  const searchParams = useSearchParams();
  const checkoutSuccess = searchParams.get('checkout') === 'success';
  if (!checkoutSuccess) return null;
  return (
    <div className="w-full bg-green-600 text-white text-center py-3 px-4 text-sm font-medium">
      🎉 Payment successful! Your plan has been upgraded.
    </div>
  );
}

function SidebarNav({ planLabel, scanCount, scansLimit, scanPct, lowOnScans, plan }: {
  planLabel: string;
  scanCount: number;
  scansLimit: number;
  scanPct: number;
  lowOnScans: boolean;
  plan: string;
}) {
  return (
    <>
      <div className="flex items-center gap-2 mb-8 px-2">
        <img src="/branding/logo-icon-dark.svg" alt="VibeTrace" className="w-7 h-7" />
        <Link href="/dashboard" className="font-semibold hover:text-white/80 transition-colors">VibeTrace</Link>
      </div>
      <nav className="flex flex-col gap-1 text-sm">
        {[
          { label: "Dashboard", href: "/dashboard", active: true },
          { label: "New Scan", href: "/scan", active: false },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={`px-3 py-2 rounded-md transition-colors ${
              item.active
                ? "bg-[#3B82F6]/10 text-[#3B82F6]"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/scans"
          className="px-3 py-2 rounded-md transition-colors text-white/50 hover:text-white hover:bg-white/5"
        >
          Repositories
        </Link>
        <Link
          href="/scans"
          className="px-3 py-2 rounded-md transition-colors text-white/50 hover:text-white hover:bg-white/5"
        >
          Reports
        </Link>
        <Link
          href="/account"
          className="px-3 py-2 rounded-md transition-colors text-white/50 hover:text-white hover:bg-white/5"
        >
          Settings
        </Link>
        <Link
          href="/account"
          className="px-3 py-2 rounded-md transition-colors text-white/50 hover:text-white hover:bg-white/5 flex items-center gap-2"
        >
          <User className="w-4 h-4" />
          Account
        </Link>
      </nav>
      <div className="mt-auto">
        <Separator className="bg-white/5 mb-4" />
        <div className="px-3 py-2 rounded-md bg-white/[0.03] text-xs text-white/40 mb-3">
          <div className="font-medium text-white/70 mb-1">{planLabel}</div>
          <div>{scanCount} / {scansLimit} scans used</div>
          <Progress value={scanPct} className="mt-2 h-1" />
          {lowOnScans && (
            <p className="mt-1.5 text-[#F59E0B]">Running low — upgrade for unlimited scans</p>
          )}
          {(plan === 'free' || plan === 'starter') && (
            <Link href="/pricing" className="mt-2 inline-block text-[#3B82F6] text-xs hover:underline">
              Upgrade →
            </Link>
          )}
        </div>
        <button
          onClick={handleSignOut}
          className="w-full px-3 py-2 rounded-md text-sm text-white/40 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
        <div>Failed to load dashboard</div>
      </div>
    );
  }

  const scanPct = (data.scan_count / data.scans_limit) * 100;
  const lowOnScans = data.scan_count > data.scans_limit * 0.6;
  const planLabel = data.plan === 'free'
    ? 'Free plan'
    : data.plan.charAt(0).toUpperCase() + data.plan.slice(1) + ' plan';

  const criticalFindings = data.findings.filter(f => f.severity === 'critical');
  const dependencyFindings = data.findings.filter(f => f.category === 'dependency');

  const sidebarProps = {
    planLabel,
    scanCount: data.scan_count,
    scansLimit: data.scans_limit,
    scanPct,
    lowOnScans,
    plan: data.plan,
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Checkout success banner */}
      <Suspense fallback={null}>
        <CheckoutBanner />
      </Suspense>

      {/* Sidebar + Main layout */}
      <div className="flex">
        {/* Desktop Sidebar — hidden on mobile */}
        <aside className="hidden md:flex md:w-56 md:fixed md:inset-y-0 border-r border-white/5 flex-col p-4 shrink-0">
          <SidebarNav {...sidebarProps} />
        </aside>

        {/* Main content — full width on mobile, offset on desktop */}
        <div className="md:ml-56 flex-1 flex flex-col min-h-screen">
          {/* Mobile top nav */}
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
                <SidebarNav {...sidebarProps} />
              </SheetContent>
            </Sheet>
          </div>

          {/* Main content */}
          <main className="flex-1 overflow-auto p-4 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold">Security Overview</h1>
                <p className="text-white/40 text-sm mt-1">
                  {data?.last_scan_at ? `Last scan: ${new Date(data.last_scan_at).toLocaleDateString()}` : 'No scans yet'}
                </p>
              </div>
              <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white" asChild>
                <Link href="/scan">+ New Scan</Link>
              </Button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Critical", value: data.severity_counts.critical, color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
                { label: "High", value: data.severity_counts.high, color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
                { label: "Medium", value: data.severity_counts.medium, color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
                { label: "Low", value: data.severity_counts.low, color: "#10B981", bg: "rgba(16,185,129,0.1)" },
              ].map((stat) => (
                <Card key={stat.label} className="bg-white/[0.02] border-white/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-white/40 uppercase tracking-wider">
                      {stat.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold" style={{ color: stat.color }}>
                      {stat.value}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Issues table */}
            <Tabs defaultValue="all">
              <TabsList className="bg-white/5 border border-white/10 mb-6">
                <TabsTrigger value="all" className="data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white">All Issues</TabsTrigger>
                <TabsTrigger value="critical" className="data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white">Critical</TabsTrigger>
                <TabsTrigger value="dependencies" className="data-[state=active]:bg-[#3B82F6] data-[state=active]:text-white">Dependencies</TabsTrigger>
              </TabsList>
              <TabsContent value="all">
                {data.findings.length === 0 ? (
                  data.scan_count > 0 || data.last_scan_at ? (
                    <CleanState />
                  ) : (
                    <EmptyState message="Run your first scan to see security findings." />
                  )
                ) : (
                  <IssuesTable findings={data.findings} />
                )}
              </TabsContent>
              <TabsContent value="critical">
                {criticalFindings.length === 0 ? (
                  <div className="text-white/40 text-center py-8">No critical issues found.</div>
                ) : (
                  <IssuesTable findings={criticalFindings} />
                )}
              </TabsContent>
              <TabsContent value="dependencies">
                {dependencyFindings.length === 0 ? (
                  <div className="text-white/40 text-center py-8">No dependency issues found.</div>
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
