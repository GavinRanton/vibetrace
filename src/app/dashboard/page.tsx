import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ChevronUp, ChevronDown, ShieldCheck } from "lucide-react";

const scansUsed = 3;
const scansTotal = 5;

const mockIssues = [
  { id: 1, severity: "critical", title: "SQL Injection in /api/users", file: "src/api/users.ts:142", cve: "CVE-2024-1234", discovered: "2h ago" },
  { id: 2, severity: "high", title: "Prototype Pollution in lodash", file: "node_modules/lodash", cve: "CVE-2019-10744", discovered: "2h ago" },
  { id: 3, severity: "high", title: "XSS via unsanitized input", file: "src/components/Search.tsx:67", cve: null, discovered: "1d ago" },
  { id: 4, severity: "medium", title: "Insecure JWT algorithm", file: "src/lib/auth.ts:23", cve: null, discovered: "3d ago" },
  { id: 5, severity: "low", title: "Missing HSTS header", file: "next.config.js", cve: null, discovered: "5d ago" },
];

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

export default function DashboardPage() {
  const scanPct = (scansUsed / scansTotal) * 100;
  const lowOnScans = scansUsed > 3;

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      {/* Sidebar + Main layout */}
      <div className="flex h-screen">
        {/* Sidebar */}
        <aside className="w-56 border-r border-white/5 flex flex-col p-4 shrink-0">
          <div className="flex items-center gap-2 mb-8 px-2">
            <div className="w-7 h-7 rounded-md bg-[#3B82F6] flex items-center justify-center">
              <span className="text-xs font-bold">VT</span>
            </div>
            <span className="font-semibold">VibeTrace</span>
          </div>
          <nav className="flex flex-col gap-1 text-sm">
            {[
              { label: "Dashboard", href: "/dashboard", active: true },
              { label: "New Scan", href: "/scan", active: false },
              { label: "Repositories", href: "/dashboard", active: false },
              { label: "Reports", href: "/dashboard", active: false },
              { label: "Settings", href: "/dashboard", active: false },
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
          </nav>
          <div className="mt-auto">
            <Separator className="bg-white/5 mb-4" />
            <div className="px-3 py-2 rounded-md bg-white/[0.03] text-xs text-white/40">
              <div className="font-medium text-white/70 mb-1">Free plan</div>
              <div>{scansUsed} / {scansTotal} scans used</div>
              <Progress value={scanPct} className="mt-2 h-1" />
              {lowOnScans && (
                <p className="mt-1.5 text-[#F59E0B]">Running low — upgrade for unlimited scans</p>
              )}
              <Link href="/pricing" className="mt-2 inline-block text-[#3B82F6] text-xs hover:underline">
                Upgrade →
              </Link>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">Security Overview</h1>
              <p className="text-white/40 text-sm mt-1">Last scan: 2 hours ago · my-app-repo</p>
            </div>
            <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white" asChild>
              <Link href="/scan">+ New Scan</Link>
            </Button>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {[
              { label: "Critical", value: "1", color: "#EF4444", bg: "rgba(239,68,68,0.1)" },
              { label: "High", value: "2", color: "#F59E0B", bg: "rgba(245,158,11,0.1)" },
              { label: "Medium", value: "1", color: "#3B82F6", bg: "rgba(59,130,246,0.1)" },
              { label: "Low", value: "1", color: "#10B981", bg: "rgba(16,185,129,0.1)" },
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
              {mockIssues.length === 0 ? (
                <Card className="bg-white/[0.02] border-white/5">
                  <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                    <ShieldCheck className="w-12 h-12 text-[#10B981]" />
                    <div className="text-center">
                      <h3 className="text-lg font-semibold text-white mb-1">No vulnerabilities found</h3>
                      <p className="text-white/40 text-sm">Your code looks clean. Run another scan to stay secure.</p>
                    </div>
                    <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white mt-2" asChild>
                      <Link href="/scan">New Scan</Link>
                    </Button>
                  </CardContent>
                </Card>
              ) : (
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
                        {mockIssues.map((issue) => {
                          const cfg = severityConfig[issue.severity];
                          return (
                            <tr key={issue.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                              <td className="px-6 py-4 w-[100px]">
                                <Badge
                                  style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}30` }}
                                >
                                  {cfg.label}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 text-white/80 font-medium" style={{ minWidth: "250px" }}>{issue.title}</td>
                              <td className="px-6 py-4 text-white/40 font-mono text-xs w-[200px] truncate overflow-hidden max-w-[200px]">{issue.file}</td>
                              <td className="px-6 py-4 w-[140px] whitespace-nowrap">
                                {issue.cve ? (
                                  <span className="text-[#3B82F6] text-xs font-mono">{issue.cve}</span>
                                ) : (
                                  <span className="text-white/20 text-xs">—</span>
                                )}
                              </td>
                              <td className="px-6 py-4 w-[120px] text-white/40 text-xs whitespace-nowrap">{issue.discovered}</td>
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
              )}
            </TabsContent>
            <TabsContent value="critical">
              <div className="text-white/40 text-center py-8">Showing critical issues only</div>
            </TabsContent>
            <TabsContent value="dependencies">
              <div className="text-white/40 text-center py-8">Showing dependency vulnerabilities</div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
