"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

type ScanState = "idle" | "scanning" | "complete";

export default function ScanPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [progress, setProgress] = useState(0);

  const handleScan = () => {
    if (!repoUrl.trim()) return;
    setScanState("scanning");
    setProgress(0);

    // Simulate scan progress
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setScanState("complete");
          return 100;
        }
        return p + Math.random() * 15;
      });
    }, 400);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex flex-col">
      {/* Nav */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#3B82F6] flex items-center justify-center">
            <span className="text-xs font-bold">VT</span>
          </div>
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
              Paste a GitHub, GitLab, or Bitbucket URL to start scanning for vulnerabilities.
            </p>
          </div>

          {/* Scan input */}
          {scanState === "idle" && (
            <Card className="bg-white/[0.02] border-white/5">
              <CardHeader>
                <CardTitle className="text-base text-white/80">Repository URL</CardTitle>
                <CardDescription className="text-white/40 text-sm">
                  Public and private repos supported. We never store your code.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3">
                  <Input
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/org/repo"
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/20 font-mono flex-1"
                    onKeyDown={(e) => e.key === "Enter" && handleScan()}
                  />
                  <Button
                    onClick={handleScan}
                    disabled={!repoUrl.trim()}
                    className="bg-[#3B82F6] hover:bg-[#2563EB] text-white px-6"
                  >
                    Scan →
                  </Button>
                </div>
                <Separator className="bg-white/5" />
                <div className="grid grid-cols-3 gap-3 text-center text-xs text-white/30">
                  {["SAST", "SCA", "Secrets", "DAST", "IaC", "SBOM"].map((tag) => (
                    <div key={tag} className="border border-white/5 rounded px-3 py-2 bg-white/[0.02]">
                      {tag}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scanning state */}
          {scanState === "scanning" && (
            <Card className="bg-white/[0.02] border-white/5">
              <CardContent className="p-8 space-y-6">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-full border-2 border-[#3B82F6] border-t-transparent animate-spin mx-auto mb-4" />
                  <p className="text-white/60 text-sm">Scanning {repoUrl}</p>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Static analysis", done: progress > 30 },
                    { label: "Dependency audit", done: progress > 55 },
                    { label: "Secret detection", done: progress > 75 },
                    { label: "Generating report", done: progress > 90 },
                  ].map((step) => (
                    <div key={step.label} className="flex items-center gap-3 text-sm">
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-xs transition-colors ${
                          step.done
                            ? "bg-[#10B981] text-white"
                            : "border border-white/20 text-white/20"
                        }`}
                      >
                        {step.done ? "✓" : "·"}
                      </div>
                      <span className={step.done ? "text-white/60" : "text-white/30"}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
                <Progress value={Math.min(progress, 100)} className="h-1" />
              </CardContent>
            </Card>
          )}

          {/* Complete state */}
          {scanState === "complete" && (
            <Card className="bg-white/[0.02] border-white/5">
              <CardContent className="p-8 text-center space-y-6">
                <div className="w-12 h-12 rounded-full bg-[#10B981]/20 flex items-center justify-center mx-auto">
                  <span className="text-[#10B981] text-xl">✓</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-1">Scan complete!</h2>
                  <p className="text-white/40 text-sm">Found 5 vulnerabilities in {repoUrl}</p>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Critical", value: "1", color: "#EF4444" },
                    { label: "High", value: "2", color: "#F59E0B" },
                    { label: "Medium", value: "1", color: "#3B82F6" },
                    { label: "Low", value: "1", color: "#10B981" },
                  ].map((s) => (
                    <div key={s.label} className="border border-white/5 rounded-lg p-3 bg-white/[0.02]">
                      <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                      <div className="text-xs text-white/40 mt-1">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 justify-center">
                  <Button className="bg-[#3B82F6] hover:bg-[#2563EB] text-white" asChild>
                    <Link href="/dashboard">View full report →</Link>
                  </Button>
                  <Button variant="outline" className="border-white/10 text-white/60 hover:text-white bg-transparent" onClick={() => { setScanState("idle"); setRepoUrl(""); }}>
                    New scan
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
