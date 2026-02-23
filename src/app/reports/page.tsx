'use client'

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ShieldCheck, User, LogOut, Menu, Download, FileText } from 'lucide-react';

type Scan = {
  id: string;
  status: string;
  score: number | null;
  total_findings: number;
  created_at: string;
  completed_at: string | null;
  repos?: { full_name: string } | null;
};

type DashboardData = {
  plan: string;
  scan_count: number;
  scans_limit: number;
  last_scan_at: string | null;
  user_email: string | null;
};

const ADMIN_EMAIL = 'gavin.ranton@gmail.com';

function handleSignOut() {
  fetch('/api/auth/logout', { method: 'POST' }).then(() => {
    window.location.href = '/';
  });
}

function scoreColor(score: number | null) {
  if (score === null) return '#6B7280';
  if (score >= 80) return '#10B981';
  if (score >= 50) return '#F59E0B';
  return '#EF4444';
}

function SidebarNav({ planLabel, scanCount, scansLimit, scanPct, lowOnScans, plan, userEmail }: {
  planLabel: string;
  scanCount: number;
  scansLimit: number;
  scanPct: number;
  lowOnScans: boolean;
  plan: string;
  userEmail: string | null;
}) {
  return (
    <>
      <div className="flex items-center gap-2 mb-8 px-2">
        <img src="/branding/logo-icon-dark.svg" alt="VibeTrace" className="w-7 h-7" />
        <Link href="/" className="font-semibold hover:text-white/80 transition-colors">VibeTrace</Link>
      </div>
      <nav className="flex flex-col gap-1 text-sm">
        {[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'New Scan', href: '/scan' },
          { label: 'Scan History', href: '/scans' },
        ].map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="px-3 py-2 rounded-md transition-colors text-white/50 hover:text-white hover:bg-white/5"
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/reports"
          className="px-3 py-2 rounded-md transition-colors bg-[#3B82F6]/10 text-[#3B82F6]"
        >
          Reports
        </Link>
        <Link
          href="/account"
          className="px-3 py-2 rounded-md transition-colors text-white/50 hover:text-white hover:bg-white/5 flex items-center gap-2"
        >
          <User className="w-4 h-4" />
          Account
        </Link>
        {userEmail === ADMIN_EMAIL && (
          <Link href="/admin" className="px-3 py-2 rounded-md transition-colors text-white/50 hover:text-white hover:bg-white/5">
            Admin
          </Link>
        )}
      </nav>
      <div className="mt-auto">
        <Separator className="bg-white/5 mb-4" />
        <div className="px-3 py-2 rounded-md bg-white/[0.03] text-xs text-white/40 mb-3">
          <div className="font-medium text-white/70 mb-1">{planLabel}</div>
          <div>{scanCount} / {scansLimit} scans used</div>
          <Progress value={scanPct} className="mt-2 h-1" />
          {lowOnScans && <p className="mt-1.5 text-[#F59E0B]">Running low — upgrade for unlimited scans</p>}
          {(plan === 'free' || plan === 'starter') && (
            <Link href="/pricing" className="mt-2 inline-block text-[#3B82F6] text-xs hover:underline">Upgrade →</Link>
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

export default function ReportsPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/scans').then(r => r.json()),
    ]).then(([dash, scanData]) => {
      setDashData(dash);
      const list: Scan[] = Array.isArray(scanData)
        ? scanData
        : (scanData?.scans ?? scanData?.data ?? []);
      setScans(list.filter((s: Scan) => s.status === 'complete'));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  const scanPct = dashData ? (dashData.scan_count / dashData.scans_limit) * 100 : 0;
  const lowOnScans = dashData ? dashData.scan_count > dashData.scans_limit * 0.6 : false;
  const planLabel = !dashData ? '' : dashData.plan === 'free'
    ? 'Free plan'
    : dashData.plan.charAt(0).toUpperCase() + dashData.plan.slice(1) + ' plan';

  const sidebarProps = {
    planLabel,
    scanCount: dashData?.scan_count ?? 0,
    scansLimit: dashData?.scans_limit ?? 5,
    scanPct,
    lowOnScans,
    plan: dashData?.plan ?? 'free',
    userEmail: dashData?.user_email ?? null,
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-56 md:fixed md:inset-y-0 border-r border-white/5 flex-col p-4 shrink-0">
          <SidebarNav {...sidebarProps} />
        </aside>

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

          <main className="flex-1 p-4 md:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold">Reports</h1>
              <p className="text-white/40 text-sm mt-1">Download PDF security reports for your completed scans.</p>
            </div>

            {scans.length === 0 ? (
              <Card className="bg-white/[0.02] border-white/5">
                <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                  <FileText className="w-12 h-12 text-white/20" />
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-1">No completed scans yet</h3>
                    <p className="text-white/40 text-sm">Run your first scan to generate a report.</p>
                  </div>
                  <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white mt-2" asChild>
                    <Link href="/scan">Run a Scan</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white/[0.02] border-white/5">
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-white/40">
                        <th className="text-left px-6 py-3 font-medium">Repository</th>
                        <th className="text-left px-6 py-3 font-medium">Date</th>
                        <th className="text-left px-6 py-3 font-medium">Score</th>
                        <th className="text-left px-6 py-3 font-medium">Findings</th>
                        <th className="text-left px-6 py-3 font-medium">Report</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scans.map((scan) => (
                        <tr key={scan.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                          <td className="px-6 py-4 text-white/80 font-medium">
                            {scan.repos?.full_name ?? '—'}
                          </td>
                          <td className="px-6 py-4 text-white/60 text-sm">
                            {scan.completed_at
                              ? new Date(scan.completed_at).toLocaleDateString()
                              : new Date(scan.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4">
                            <Badge style={{
                              backgroundColor: `${scoreColor(scan.score)}20`,
                              color: scoreColor(scan.score),
                              border: `1px solid ${scoreColor(scan.score)}40`,
                            }}>
                              {scan.score ?? '—'}/100
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-white/60">
                            {scan.total_findings}
                          </td>
                          <td className="px-6 py-4">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-[#3B82F6] hover:text-[#60A5FA] h-7 text-xs gap-1.5"
                              asChild
                            >
                              <a href={`/api/reports/${scan.id}/pdf`} download>
                                <Download className="w-3 h-3" />
                                Download PDF
                              </a>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
