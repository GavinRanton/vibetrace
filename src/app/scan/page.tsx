"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2, Github, Search, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PageState = "loading-session" | "no-token" | "loading-repos" | "idle" | "scanning" | "error";

interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  description: string | null;
  updated_at: string;
  language: string | null;
}

export default function ScanPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("loading-session");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [search, setSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.provider_token) {
        setPageState("no-token");
        return;
      }

      setPageState("loading-repos");
      try {
        const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=50", {
          headers: {
            Authorization: `Bearer ${session.provider_token}`,
            Accept: "application/vnd.github+json",
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch repositories from GitHub.");
        }

        const data: GitHubRepo[] = await res.json();
        setRepos(data);
        setPageState("idle");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load repositories.";
        setErrorMessage(message);
        setPageState("error");
      }
    }

    init();
  }, []);

  const handleSignInWithGitHub = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/scan`,
        scopes: "repo",
      },
    });
  };

  const handleScan = async () => {
    if (!selectedRepo) return;
    setPageState("scanning");
    setErrorMessage("");

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_id: selectedRepo.id,
          repo_full_name: selectedRepo.full_name,
        }),
      });

      if (res.ok) {
        router.push("/dashboard");
        return;
      }

      let message = "An error occurred. Please try again.";
      try {
        const body = await res.json();
        message = body.error || body.message || message;
      } catch {
        // use default message
      }

      setErrorMessage(message);
      setPageState("error");
    } catch {
      setErrorMessage("Network error. Please check your connection and try again.");
      setPageState("error");
    }
  };

  const filteredRepos = repos.filter((repo) =>
    repo.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <img src="/branding/logo-icon-dark.svg" alt="VibeTrace" className="w-7 h-7" />
          <span className="font-semibold">VibeTrace</span>
        </Link>
        <Button variant="ghost" size="sm" className="text-white/50" asChild>
          <Link href="/dashboard">Dashboard</Link>
        </Button>
      </nav>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <Badge className="mb-4 bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20">
              AI-Powered Scanner
            </Badge>
            <h1 className="text-4xl font-bold mb-3">Scan your repository</h1>
            <p className="text-white/40">
              Select a GitHub repository to start scanning for vulnerabilities.
            </p>
          </div>

          {/* Loading session */}
          {pageState === "loading-session" && (
            <Card className="bg-white/[0.02] border-white/5">
              <CardContent className="p-10 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
                <p className="text-white/40 text-sm">Checking session…</p>
              </CardContent>
            </Card>
          )}

          {/* No GitHub token */}
          {pageState === "no-token" && (
            <Card className="bg-white/[0.02] border-white/5">
              <CardContent className="p-10 flex flex-col items-center justify-center gap-6 text-center">
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center">
                  <Github className="w-7 h-7 text-white/40" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-2">Connect GitHub to scan</h2>
                  <p className="text-white/40 text-sm">Sign in with GitHub to continue.</p>
                </div>
                <Button
                  onClick={handleSignInWithGitHub}
                  className="bg-white text-black hover:bg-white/90 gap-2"
                >
                  <Github className="w-4 h-4" />
                  Sign in with GitHub
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Loading repos */}
          {pageState === "loading-repos" && (
            <Card className="bg-white/[0.02] border-white/5">
              <CardContent className="p-10 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
                <p className="text-white/40 text-sm">Loading your repositories…</p>
              </CardContent>
            </Card>
          )}

          {/* Repo selector (idle) */}
          {pageState === "idle" && (
            <Card className="bg-white/[0.02] border-white/5">
              <CardHeader>
                <CardTitle className="text-base text-white/80">Select a repository</CardTitle>
                <CardDescription className="text-white/40 text-sm">
                  Choose a repository from your GitHub account. We never store your code.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter repositories…"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 pl-9"
                  />
                </div>

                {/* Repo list */}
                <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
                  {filteredRepos.length === 0 ? (
                    <p className="text-white/30 text-sm text-center py-6">No repositories found.</p>
                  ) : (
                    filteredRepos.map((repo) => {
                      const isSelected = selectedRepo?.id === repo.id;
                      return (
                        <button
                          key={repo.id}
                          onClick={() => setSelectedRepo(repo)}
                          className={`w-full text-left px-4 py-3 rounded-lg border transition-colors flex items-center justify-between gap-3 ${
                            isSelected
                              ? "border-[#3B82F6]/50 bg-[#3B82F6]/10"
                              : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-mono text-white/80 truncate">
                                {repo.full_name}
                              </span>
                              {repo.private && (
                                <Badge className="text-[10px] bg-white/5 text-white/30 border-white/10 py-0 px-1.5">
                                  private
                                </Badge>
                              )}
                            </div>
                            {repo.description && (
                              <p className="text-xs text-white/30 truncate mt-0.5">
                                {repo.description}
                              </p>
                            )}
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-[#3B82F6] shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Scan button */}
                <Button
                  onClick={handleScan}
                  disabled={!selectedRepo}
                  className="w-full bg-[#3B82F6] hover:bg-[#2563EB] text-white disabled:opacity-40"
                >
                  Scan Now →
                </Button>

                {/* Scan types */}
                <div className="grid grid-cols-3 gap-3 text-center text-xs text-white/30 pt-1">
                  {["SAST", "SCA", "Secrets", "DAST", "IaC", "SBOM"].map((tag) => (
                    <div
                      key={tag}
                      className="border border-white/5 rounded px-3 py-2 bg-white/[0.02]"
                    >
                      {tag}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scanning state */}
          {pageState === "scanning" && selectedRepo && (
            <Card className="bg-white/[0.02] border-white/5">
              <CardContent className="p-10 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 text-[#3B82F6] animate-spin" />
                <div className="text-center">
                  <p className="text-white/80 font-medium">
                    Scanning {selectedRepo.full_name}…
                  </p>
                  <p className="text-white/30 text-sm mt-1">This may take a moment.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error state */}
          {pageState === "error" && (
            <div className="space-y-4">
              <div className="flex gap-3 items-start bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-4">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-medium text-sm">Something went wrong</p>
                  <p className="text-red-400/70 text-sm mt-0.5">{errorMessage}</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRepo(null);
                  setErrorMessage("");
                  setPageState("idle");
                }}
                className="w-full border-white/10 text-white/60 hover:text-white bg-transparent"
              >
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
