"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/app-sidebar";
import { Menu, FileText, ChevronDown, ChevronUp, Download, ShieldCheck } from "lucide-react";

type Finding = {
  id: string;
  severity: string;
  plain_english: string;
  fix_prompt: string | null;
  verification_step: string | null;
  file_path: string;
  line_number: number | null;
};

type Scan = {
  id: string;
  status: string;
  score: number | null;
  total_findings: number;
  created_at: string;
  completed_at: string | null;
  repo_full_name: string | null;
};

type DashData = {
  plan: string;
  scan_count: number;
  scans_limit: number;
  user_email: string | null;
};

const SEV: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "#EF4444", bg: "rgba(239,68,68,0.1)",  label: "Critical" },
  high:     { color: "#F59E0B", bg: "rgba(245,158,11,0.1)", label: "High"     },
  medium:   { color: "#3B82F6", bg: "rgba(59,130,246,0.1)", label: "Medium"   },
  low:      { color: "#10B981", bg: "rgba(16,185,129,0.1)", label: "Low"      },
};

function scoreColor(s: number | null) {
  if (s === null) return "#6B7280";
  if (s >= 80) return "#10B981";
  if (s >= 50) return "#F59E0B";
  return "#EF4444";
}

function stripPath(p: string) {
  return p.replace(/^.*vibetrace-scan-[^/]+\//, "");
}

function ScanReportRow({ scan }: { scan: Scan }) {
  const [open, setOpen] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loadingFindings, setLoadingFindings] = useState(false);

  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (findings.length > 0) return;
    setLoadingFindings(true);
    const res = await fetch(`/api/scans?scan_id=${scan.id}`);
    const data = await res.json();
    setFindings(data.findings ?? []);
    setLoadingFindings(false);
  }

  const sc = scoreColor(scan.score);
  const date = scan.completed_at ?? scan.created_at;

  return (
    <>
      <tr
        className={`border-b border-white/5 transition-colors cursor-pointer hover:bg-white/[0.03] ${open ? "bg-white/[0.04]" : ""}`}
        onClick={toggle}
      >
        <td className="px-6 py-4 text-white/80 font-mono text-sm">
          {scan.repo_full_name ?? <span className="text-white/30 italic">URL-only</span>}
        </td>
        <td className="px-6 py-4 text-white/50 text-sm whitespace-nowrap">
          {new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </td>
        <td className="px-6 py-4">
          <Badge style={{ backgroundColor: `${sc}20`, color: sc, border: `1px solid ${sc}40` }}>
            {scan.score ?? "—"}/100
          </Badge>
        </td>
        <td className="px-6 py-4 text-white/60">{scan.total_findings}</td>
        <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="ghost" className="text-[#3B82F6] hover:text-[#60A5FA] h-7 text-xs gap-1.5" asChild>
            <a href={`/api/reports/${scan.id}/pdf`} download>
              <Download className="w-3 h-3" />PDF
            </a>
          </Button>
        </td>
        <td className="px-6 py-4 text-white/30">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={6} className="px-6 py-4 bg-white/[0.02] border-b border-white/5">
            {loadingFindings ? (
              <p className="text-white/40 text-sm text-center py-4">Loading findings…</p>
            ) : findings.length === 0 ? (
              <div className="flex items-center gap-3 py-2">
                <ShieldCheck className="w-5 h-5 text-[#10B981]" />
                <p className="text-white/60 text-sm">No vulnerabilities found in this scan.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-white/40 text-xs uppercase tracking-wider font-semibold">
                  {findings.length} finding{findings.length !== 1 ? "s" : ""}
                </p>
                {findings.map((f) => {
                  const cfg = SEV[f.severity] ?? SEV.low;
                  const loc = f.file_path
                    ? stripPath(f.file_path) + (f.line_number ? `:${f.line_number}` : "")
                    : null;
                  return (
                    <div key={f.id} className="border border-white/5 rounded-lg p-4 bg-white/[0.02] space-y-3">
                      <div className="flex items-start gap-3 flex-wrap">
                        <Badge style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}>
                          {cfg.label}
                        </Badge>
                        {loc && <span className="text-white/40 font-mono text-xs self-center">{loc}</span>}
                      </div>
                      <p className="text-white/80 text-sm">{f.plain_english}</p>
                      {f.fix_prompt && (
                        <div>
                          <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-2">Fix Prompt</p>
                          <pre className="bg-black/30 border border-white/10 rounded p-3 text-xs text-white/70 font-mono whitespace-pre-wrap break-words leading-relaxed">
                            {f.fix_prompt}
                          </pre>
                        </div>
                      )}
                      {f.verification_step && (
                        <div>
                          <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-1">How to verify</p>
                          <p className="text-white/60 text-sm">{f.verification_step}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function ReportsPage() {
  const [scans, setScans] = useState<Scan[]>([]);
  const [dashData, setDashData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/scans").then((r) => r.json()),
    ]).then(([dash, scanData]) => {
      setDashData(dash);
      const list: Scan[] = scanData?.scans ?? [];
      setScans(list.filter((s) => s.status === "complete"));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const sidebarProps = {
    activePath: "/reports",
    userEmail: dashData?.user_email ?? null,
    plan: dashData?.plan,
    scanCount: dashData?.scan_count,
    scansLimit: dashData?.scans_limit,
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
      <div className="text-white/40">Loading…</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="flex">
        <aside className="hidden md:flex md:w-56 md:fixed md:inset-y-0 border-r border-white/5 flex-col p-4 shrink-0">
          <AppSidebar {...sidebarProps} />
        </aside>

        <div className="md:ml-56 flex-1 flex flex-col min-h-screen">
          <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0A0A0F] sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <img src="/branding/logo-icon-dark.svg" alt="VibeTrace" className="w-6 h-6" />
              <span className="font-semibold text-sm">VibeTrace</span>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white/60"><Menu className="w-5 h-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-56 bg-[#0A0A0F] border-white/5 p-4 flex flex-col">
                <AppSidebar {...sidebarProps} />
              </SheetContent>
            </Sheet>
          </div>

          <main className="flex-1 p-4 md:p-8">
            <div className="mb-8">
              <h1 className="text-2xl font-bold">Reports</h1>
              <p className="text-white/40 text-sm mt-1">
                Click any row to see findings with fix prompts. Download PDF for sharing.
              </p>
            </div>

            {scans.length === 0 ? (
              <Card className="bg-white/[0.02] border-white/5">
                <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                  <FileText className="w-12 h-12 text-white/20" />
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-1">No completed scans</h3>
                    <p className="text-white/40 text-sm">Run your first scan to generate a report.</p>
                  </div>
                  <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white mt-2" asChild>
                    <Link href="/scan">Run a Scan</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white/[0.02] border-white/5">
                <CardContent className="p-0 overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-white/5 text-white/40">
                        <th className="text-left px-6 py-3 font-medium">Repository</th>
                        <th className="text-left px-6 py-3 font-medium">Date</th>
                        <th className="text-left px-6 py-3 font-medium">Score</th>
                        <th className="text-left px-6 py-3 font-medium">Findings</th>
                        <th className="text-left px-6 py-3 font-medium">PDF</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {scans.map((scan) => <ScanReportRow key={scan.id} scan={scan} />)}
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
