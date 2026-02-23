"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/app-sidebar";
import { Menu, GitBranch, ScanLine, Lock } from "lucide-react";

type Repo = {
  id: string;
  full_name: string;
  name: string;
  is_private: boolean;
  last_scanned_at: string | null;
  created_at: string;
  scan_count: number;
};

type DashData = {
  plan: string;
  scan_count: number;
  scans_limit: number;
  user_email: string | null;
};

export default function RepositoriesPage() {
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [dashData, setDashData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanningRepoId, setScanningRepoId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/repositories").then((r) => r.json()),
      fetch("/api/dashboard").then((r) => r.json()),
    ]).then(([repoData, dash]) => {
      setRepos(repoData.repos ?? []);
      setDashData(dash);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleScan(repo: Repo) {
    setScanningRepoId(repo.id);
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_full_name: repo.full_name }),
      });
      if (res.ok) {
        const { scan_id } = await res.json();
        router.push(`/scans?id=${scan_id}`);
      } else {
        // If the POST fails (e.g. needs github token), redirect to scan page instead
        router.push(`/scan`);
      }
    } catch {
      router.push(`/scan`);
    } finally {
      setScanningRepoId(null);
    }
  }

  const sidebarProps = {
    activePath: "/repositories",
    userEmail: dashData?.user_email ?? null,
    plan: dashData?.plan,
    scanCount: dashData?.scan_count,
    scansLimit: dashData?.scans_limit,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex items-center justify-center">
        <div className="text-white/40">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-56 md:fixed md:inset-y-0 border-r border-white/5 flex-col p-4 shrink-0">
          <AppSidebar {...sidebarProps} />
        </aside>

        <div className="md:ml-56 flex-1 flex flex-col min-h-screen">
          {/* Mobile nav */}
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
                <h1 className="text-2xl font-bold">Repositories</h1>
                <p className="text-white/40 text-sm mt-1">
                  {repos.length} connected repositor{repos.length !== 1 ? "ies" : "y"}
                </p>
              </div>
              <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white" asChild>
                <Link href="/scan">+ New Scan</Link>
              </Button>
            </div>

            {repos.length === 0 ? (
              <Card className="bg-white/[0.02] border-white/5">
                <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                  <GitBranch className="w-12 h-12 text-white/20" />
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-1">No repositories yet</h3>
                    <p className="text-white/40 text-sm">Run your first scan to connect a repository.</p>
                  </div>
                  <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white mt-2" asChild>
                    <Link href="/scan">Scan a Repository</Link>
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
                        <th className="text-left px-6 py-3 font-medium">Scans</th>
                        <th className="text-left px-6 py-3 font-medium">Last Scanned</th>
                        <th className="text-left px-6 py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repos.map((repo) => (
                        <tr
                          key={repo.id}
                          className="border-b border-white/5 hover:bg-white/[0.03] transition-colors last:border-0"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <GitBranch className="w-4 h-4 text-white/30 shrink-0" />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-white/80 font-mono text-sm">
                                    {repo.full_name}
                                  </span>
                                  {repo.is_private && (
                                    <Lock className="w-3 h-3 text-white/30" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge className="bg-white/5 text-white/60 border-white/10">
                              {repo.scan_count} scan{repo.scan_count !== 1 ? "s" : ""}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-white/50 text-sm">
                            {repo.last_scanned_at
                              ? new Date(repo.last_scanned_at).toLocaleDateString("en-GB", {
                                  day: "numeric", month: "short", year: "numeric",
                                })
                              : <span className="text-white/25 italic">Never</span>
                            }
                          </td>
                          <td className="px-6 py-4">
                            <Button
                              size="sm"
                              onClick={() => handleScan(repo)}
                              disabled={scanningRepoId === repo.id}
                              className="bg-[#3B82F6] hover:bg-[#2563EB] text-white h-8 text-xs gap-1.5"
                            >
                              <ScanLine className="w-3.5 h-3.5" />
                              {scanningRepoId === repo.id ? "Starting…" : "Run Scan"}
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
