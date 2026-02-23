"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "@/components/app-sidebar";
import { Menu, GitBranch, ScanLine, Lock, RefreshCw, KeyRound } from "lucide-react";

type DbRepo = {
  id: string;
  full_name: string;
  name: string;
  is_private: boolean;
  last_scanned_at: string | null;
  created_at: string;
  scan_count: number;
};

type GhRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  updated_at: string;
};

type MergedRepo = {
  db_id: string | null;
  full_name: string;
  name: string;
  is_private: boolean;
  last_scanned_at: string | null;
  scan_count: number;
  default_branch: string;
};

type DashData = {
  plan: string;
  scan_count: number;
  scans_limit: number;
  user_email: string | null;
};

export default function RepositoriesPage() {
  const router = useRouter();
  const [repos, setRepos] = useState<MergedRepo[]>([]);
  const [dashData, setDashData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [scanningRepo, setScanningRepo] = useState<string | null>(null);
  const [githubToken, setGithubToken] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function loadData(showSyncing = false) {
    if (showSyncing) setSyncing(true);
    else setLoading(true);
    try {
      // Get GitHub token from session
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.provider_token ?? null;
      setGithubToken(token);

      // Load DB repos and dashboard data in parallel
      const [repoRes, dashRes] = await Promise.all([
        fetch("/api/repositories"),
        fetch("/api/dashboard"),
      ]);
      const [repoData, dash] = await Promise.all([
        repoRes.json(),
        dashRes.json(),
      ]);
      setDashData(dash);

      const dbRepos: DbRepo[] = repoData.repos ?? [];
      const dbMap = new Map(dbRepos.map((r) => [r.full_name, r]));

      // If we have a GitHub token, also fetch all GitHub repos (including private)
      let merged: MergedRepo[] = dbRepos.map((r) => ({
        db_id: r.id,
        full_name: r.full_name,
        name: r.name,
        is_private: r.is_private,
        last_scanned_at: r.last_scanned_at,
        scan_count: r.scan_count,
        default_branch: "main",
      }));

      if (token) {
        const ghRes = await fetch("/api/github/repos", { cache: "no-store" });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          const ghRepos: GhRepo[] = ghData.repos ?? [];

          // Add any GitHub repos not yet in DB
          for (const ghRepo of ghRepos) {
            if (!dbMap.has(ghRepo.full_name)) {
              merged.push({
                db_id: null,
                full_name: ghRepo.full_name,
                name: ghRepo.name,
                is_private: ghRepo.private,
                last_scanned_at: null,
                scan_count: 0,
                default_branch: ghRepo.default_branch,
              });
            } else {
              // Update is_private from GitHub (DB might be stale)
              const existing = merged.find((m) => m.full_name === ghRepo.full_name);
              if (existing) existing.is_private = ghRepo.private;
            }
          }
        }
      }

      // Sort: most recently scanned first, then alphabetical
      merged.sort((a, b) => {
        if (a.last_scanned_at && b.last_scanned_at) {
          return new Date(b.last_scanned_at).getTime() - new Date(a.last_scanned_at).getTime();
        }
        if (a.last_scanned_at) return -1;
        if (b.last_scanned_at) return 1;
        return a.full_name.localeCompare(b.full_name);
      });

      setRepos(merged);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const hasPrivateRepos = repos.some((r) => r.is_private);

  async function reconnectGitHub() {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        scopes: "repo read:user user:email",
        redirectTo: `${window.location.origin}/repositories`,
        queryParams: { prompt: "consent" },
      },
    });
  }

  async function handleScan(repo: MergedRepo) {
    setScanningRepo(repo.full_name);
    try {
      const body: Record<string, unknown> = {
        repo_full_name: repo.full_name,
        repo_id: repo.db_id ?? undefined,
      };
      // Always send github_token so private repos work
      if (githubToken) body.github_token = githubToken;

      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const { scan_id } = await res.json();
        router.push(`/scans?id=${scan_id}`);
      } else {
        // Needs re-auth — redirect to scan page
        router.push(`/scan`);
      }
    } catch {
      router.push(`/scan`);
    } finally {
      setScanningRepo(null);
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
        <div className="text-white/40">Loading repositories…</div>
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
                  {repos.length} repositor{repos.length !== 1 ? "ies" : "y"} connected
                  {!githubToken && (
                    <span className="ml-2 text-amber-400/70">· Sign in again to see private repos</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!githubToken && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={reconnectGitHub}
                    className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-1.5 text-xs"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Reconnect GitHub
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => loadData(true)}
                  disabled={syncing}
                  className="text-white/40 hover:text-white/70 gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Syncing…" : "Sync"}
                </Button>
                <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white" asChild>
                  <Link href="/scan">+ New Scan</Link>
                </Button>
              </div>
            </div>

            {repos.length === 0 ? (
              <Card className="bg-white/[0.02] border-white/5">
                <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
                  <GitBranch className="w-12 h-12 text-white/20" />
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-white mb-1">No repositories found</h3>
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
                          key={repo.full_name}
                          className="border-b border-white/5 hover:bg-white/[0.03] transition-colors last:border-0"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <GitBranch className="w-4 h-4 text-white/30 shrink-0" />
                              <div className="flex items-center gap-2">
                                <span className="text-white/80 font-mono text-sm">{repo.full_name}</span>
                                {repo.is_private && (
                                  <span className="flex items-center gap-1 text-white/30 text-xs">
                                    <Lock className="w-3 h-3" />
                                    private
                                  </span>
                                )}
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
                              disabled={scanningRepo === repo.full_name}
                              className="bg-[#3B82F6] hover:bg-[#2563EB] text-white h-8 text-xs gap-1.5"
                            >
                              <ScanLine className="w-3.5 h-3.5" />
                              {scanningRepo === repo.full_name ? "Starting…" : "Run Scan"}
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
