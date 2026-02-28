"use client";
import React from "react";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Menu,
  ShieldCheck,
  X,
} from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";

type Scan = {
  id: string;
  status: string;
  score: number | null;
  total_findings: number | null;
  critical_count: number | null;
  high_count: number | null;
  medium_count: number | null;
  low_count: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  repo_id: string | null;
  repo_full_name: string | null;
  zap_included: boolean | null;
};

type Finding = {
  id: string;
  severity: string;
  category: string;
  file_path: string;
  line_number: number | null;
  plain_english: string;
  actual_error: string;
  fix_prompt: string;
  business_impact: string;
  verification_step: string;
  status: string;
  created_at: string;
};

type ScansData = {
  scans: Scan[];
  findings: Finding[];
};

const severityConfig: Record<string, { color: string; bg: string; label: string }> = {
  critical: { color: "#EF4444", bg: "rgba(239,68,68,0.1)", label: "Critical" },
  high: { color: "#F59E0B", bg: "rgba(245,158,11,0.1)", label: "High" },
  medium: { color: "#3B82F6", bg: "rgba(59,130,246,0.1)", label: "Medium" },
  low: { color: "#10B981", bg: "rgba(16,185,129,0.1)", label: "Low" },
};


function StatusBadge({ status }: { status: string }) {
  if (status === "complete") {
    return (
      <Badge className="bg-green-500/10 text-green-400 border-green-500/20">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Complete
      </Badge>
    );
  }
  if (status === "failed") {
    return (
      <Badge className="bg-red-500/10 text-red-400 border-red-500/20">
        <AlertCircle className="w-3 h-3 mr-1" />
        Failed
      </Badge>
    );
  }
  // scanning, pending, cloning, translating, dast_scanning
  return (
    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">
      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
      {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ")}
    </Badge>
  );
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-white/30">—</span>;
  if (score === 100) {
    return (
      <span className="inline-flex items-center gap-1 text-green-400 font-medium">
        Clean <CheckCircle2 className="w-4 h-4" />
      </span>
    );
  }
  const color = score >= 80 ? "text-amber-400" : "text-red-400";
  return <span className={`font-medium ${color}`}>{score}</span>;
}

function ScansPageContent({ highlightId }: { highlightId: string | null }) {

  const [data, setData] = useState<ScansData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(highlightId);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [findingsLoading, setFindingsLoading] = useState(false);

  const fetchScans = useCallback(async (scanIdForFindings?: string) => {
    try {
      const url = scanIdForFindings
        ? `/api/scans?scan_id=${scanIdForFindings}`
        : "/api/scans";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch");
      const json: ScansData = await res.json();
      setData(json);
      if (scanIdForFindings) {
        setFindings(json.findings || []);
        setFindingsLoading(false);
      }
      setLoading(false);
    } catch {
      setError(true);
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchScans(highlightId ?? undefined);
  }, [fetchScans, highlightId]);

  // Polling: every 3s if there's an active scan
  useEffect(() => {
    if (!data) return;

    const hasActiveScan = data.scans.some(
      (s) => !["complete", "failed"].includes(s.status)
    );

    if (!hasActiveScan) return;

    const interval = setInterval(() => {
      fetchScans(selectedScanId ?? undefined);
    }, 3000);

    return () => clearInterval(interval);
  }, [data, fetchScans, selectedScanId]);

  const handleRowClick = (scan: Scan) => {
    if (scan.status !== "complete") return;
    if (selectedScanId === scan.id) {
      setSelectedScanId(null);
      setFindings([]);
      return;
    }
    setSelectedScanId(scan.id);
    setFindingsLoading(true);
    fetchScans(scan.id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-white/60">Failed to load scans</p>
          <Button
            variant="outline"
            className="mt-4 border-white/10 text-white/60"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const selectedScan = data.scans.find((s) => s.id === selectedScanId);

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:w-56 md:fixed md:inset-y-0 border-r border-white/5 flex-col p-4 shrink-0">
          <AppSidebar activePath="/scans" />
        </aside>

        {/* Main content */}
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
                <AppSidebar activePath="/scans" />
              </SheetContent>
            </Sheet>
          </div>

          <main className="flex-1 overflow-auto p-4 md:p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold">Scan History</h1>
                <p className="text-white/40 text-sm mt-1">
                  {data.scans.length} scan{data.scans.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white" asChild>
                <Link href="/scan">+ New Scan</Link>
              </Button>
            </div>

            {data.scans.length === 0 ? (
              <Card className="bg-white/[0.02] border-white/5">
                <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                  <ShieldCheck className="w-12 h-12 text-[#3B82F6]" />
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-1">No scans yet</h3>
                    <p className="text-white/40 text-sm">Start your first scan to see results here.</p>
                  </div>
                  <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white mt-2" asChild>
                    <Link href="/scan">New Scan</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-white/[0.02] border-white/5">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[600px]">
                      <thead>
                        <tr className="border-b border-white/5 text-white/40">
                          <th className="text-left px-6 py-3 font-medium">Date</th>
                          <th className="text-left px-6 py-3 font-medium">Repository</th>
                          <th className="text-left px-6 py-3 font-medium">Score</th>
                          <th className="text-left px-6 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.scans.map((scan) => {
                          const isHighlighted = scan.id === highlightId;
                          const isSelected = scan.id === selectedScanId;
                          const isClickable = scan.status === "complete";

                          return (
                            <>
                              <tr
                                key={scan.id}
                                onClick={() => handleRowClick(scan)}
                                className={`border-b border-white/5 transition-colors ${
                                  isHighlighted ? "bg-[#3B82F6]/10" : ""
                                } ${isSelected ? "bg-white/[0.05]" : ""} ${
                                  isClickable ? "cursor-pointer hover:bg-white/[0.03]" : ""
                                }`}
                              >
                                <td className="px-6 py-4 text-white/60 text-xs whitespace-nowrap">
                                  {new Date(scan.created_at).toLocaleDateString()}{" "}
                                  {new Date(scan.created_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </td>
                                <td className="px-6 py-4 text-white/80 font-mono text-xs">
                                  {scan.repo_full_name ?? (
                                    <span className="text-white/30 italic">URL-only scan</span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  <ScoreBadge score={scan.score} />
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2">
                                    <StatusBadge status={scan.status} />
                                    {isClickable && (
                                      <span className="text-white/20">
                                        {isSelected ? (
                                          <ChevronUp className="w-4 h-4" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4" />
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              {isSelected && selectedScan && (
                                <tr key={`${scan.id}-findings`}>
                                  <td colSpan={4} className="px-6 py-4 bg-white/[0.02]">
                                    <FindingsPanel
                                      findings={findings}
                                      loading={findingsLoading}
                                      scan={selectedScan}
                                      onClose={() => {
                                        setSelectedScanId(null);
                                        setFindings([]);
                                      }}
                                    />
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function FindingsPanel({
  findings,
  loading,
  scan,
  onClose,
}: {
  findings: Finding[];
  loading: boolean;
  scan: Scan;
  onClose: () => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-[#3B82F6]" />
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-green-400" />
          <div>
            <p className="text-white font-medium">No issues found</p>
            {scan.zap_included ? (
              <p className="text-white/40 text-sm">Live site scan complete — no vulnerabilities detected. ZAP checked for XSS, SQL injection, missing security headers, CSRF, and more.</p>
            ) : (
              <p className="text-white/40 text-sm">Your code is clean!</p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white/40">
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  const [activeTab, setActiveTab] = React.useState<"security" | "seo">("security");

  const securityFindings = findings.filter(f => f.category !== "seo");
  const seoFindings = findings.filter(f => f.category === "seo");
  const hasSeo = seoFindings.length > 0;
  const visibleFindings = activeTab === "seo" ? seoFindings : securityFindings;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <span className="text-white/60 text-sm">{findings.length} finding{findings.length !== 1 ? "s" : ""}</span>
          {scan.critical_count ? (
            <Badge className="bg-red-500/10 text-red-400 border-red-500/20 text-xs">
              {scan.critical_count} critical
            </Badge>
          ) : null}
          {scan.high_count ? (
            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
              {scan.high_count} high
            </Badge>
          ) : null}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="text-white/40">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {hasSeo && (
        <div className="flex gap-1 mb-3 border-b border-white/10 pb-2">
          <button
            onClick={() => setActiveTab("security")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === "security" ? "bg-[#3B82F6]/20 text-[#3B82F6]" : "text-white/40 hover:text-white/60"}`}
          >
            🔒 Security ({securityFindings.length})
          </button>
          <button
            onClick={() => setActiveTab("seo")}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${activeTab === "seo" ? "bg-green-500/20 text-green-400" : "text-white/40 hover:text-white/60"}`}
          >
            🔍 SEO ({seoFindings.length})
          </button>
        </div>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {visibleFindings.length === 0 ? (
          <div className="flex items-center gap-3 py-4">
            <ShieldCheck className="w-6 h-6 text-green-400" />
            <p className="text-white/60 text-sm">
              {activeTab === "seo" ? "No SEO issues detected." : "No security issues detected."}
            </p>
          </div>
        ) : visibleFindings.map((f) => {
          const cfg = severityConfig[f.severity] ?? severityConfig.low;
          return (
            <div
              key={f.id}
              className="p-3 rounded-lg border border-white/5 bg-white/[0.02]"
            >
              <div className="flex items-start gap-3">
                <Badge
                  style={{
                    backgroundColor: cfg.bg,
                    color: cfg.color,
                    border: `1px solid ${cfg.color}30`,
                  }}
                  className="shrink-0 mt-0.5"
                >
                  {cfg.label}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-white/80 text-sm font-medium">{f.plain_english}</p>

                  {f.category === "seo" ? (
                    <div className="mt-2 space-y-2">
                      {f.business_impact && (
                        <p className="text-amber-400/70 text-xs">⚠️ {f.business_impact}</p>
                      )}
                      {f.fix_prompt && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-green-400/70 text-xs font-medium">🔧 Fix prompt — copy into Lovable or Cursor:</span>
                            <button
                              onClick={() => navigator.clipboard?.writeText(f.fix_prompt)}
                              className="text-[10px] text-white/30 hover:text-white/60 px-2 py-0.5 rounded border border-white/10 hover:border-white/20 transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                          <pre className="bg-green-900/20 border border-green-500/20 rounded p-2 text-[11px] text-green-300/80 font-mono whitespace-pre-wrap break-words leading-relaxed max-h-32 overflow-y-auto">{f.fix_prompt}</pre>
                        </div>
                      )}
                      {f.verification_step && (
                        <p className="text-white/30 text-xs">✓ {f.verification_step}</p>
                      )}
                    </div>
                  ) : (
                    <pre className="mt-2 bg-black/30 border border-white/10 rounded p-2 text-[11px] text-white/60 font-mono whitespace-pre-wrap break-words leading-relaxed max-h-20 overflow-hidden">{f.actual_error}</pre>
                  )}

                  <p className="text-white/20 text-xs font-mono mt-1 truncate">
                    {f.file_path}
                    {f.line_number ? `:${f.line_number}` : ""}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ScansPageWithParams() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("id");
  return <ScansPageContent highlightId={highlightId} />;
}

export default function ScansPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#3B82F6]" />
        </div>
      }
    >
      <ScansPageWithParams />
    </Suspense>
  );
}
