"use client";

import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { LogOut, Shield } from "lucide-react";

const ADMIN_EMAIL = "gavin.ranton@gmail.com";

const NAV_ITEMS = [
  { label: "Dashboard",    href: "/dashboard" },
  { label: "New Scan",     href: "/scan" },
  { label: "Scan History", href: "/scans" },
  { label: "Reports",      href: "/reports" },
  { label: "Account",     href: "/account" },
];

function handleSignOut() {
  fetch("/api/auth/logout", { method: "POST" }).then(() => {
    window.location.href = "/";
  });
}

interface AppSidebarProps {
  activePath: string;
  userEmail?: string | null;
  plan?: string;
  scanCount?: number;
  scansLimit?: number;
}

export function AppSidebar({
  activePath,
  userEmail,
  plan,
  scanCount,
  scansLimit,
}: AppSidebarProps) {
  const showUsage = plan !== undefined && scanCount !== undefined && scansLimit !== undefined;
  const scanPct = showUsage ? Math.min(100, (scanCount! / scansLimit!) * 100) : 0;
  const planLabel = !plan ? "" : plan === "free"
    ? "Free plan"
    : plan.charAt(0).toUpperCase() + plan.slice(1) + " plan";

  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8 px-2">
        <img src="/branding/logo-icon-dark.svg" alt="VibeTrace" className="w-7 h-7" />
        <Link href="/" className="font-semibold hover:text-white/80 transition-colors">
          VibeTrace
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 text-sm flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activePath === item.href || activePath.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-[#3B82F6]/10 text-[#3B82F6]"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              {item.label}
            </Link>
          );
        })}

        {/* Admin — only for Gavin */}
        {userEmail === ADMIN_EMAIL && (
          <Link
            href="/admin"
            className={`px-3 py-2 rounded-md transition-colors flex items-center gap-2 ${
              activePath === "/admin"
                ? "bg-[#3B82F6]/10 text-[#3B82F6]"
                : "text-white/50 hover:text-white hover:bg-white/5"
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Admin
          </Link>
        )}
      </nav>

      {/* Bottom: usage + sign out */}
      <div className="mt-auto pt-4">
        <Separator className="bg-white/5 mb-4" />

        {showUsage && (
          <div className="px-3 py-2 rounded-md bg-white/[0.03] text-xs text-white/40 mb-3">
            <div className="font-medium text-white/70 mb-1">{planLabel}</div>
            <div>{scanCount} / {scansLimit} scans used</div>
            <Progress value={scanPct} className="mt-2 h-1" />
            {scanPct > 60 && (
              <p className="mt-1.5 text-[#F59E0B]">Running low — upgrade for unlimited</p>
            )}
            {(plan === "free" || plan === "starter") && (
              <Link href="/pricing" className="mt-2 inline-block text-[#3B82F6] hover:underline">
                Upgrade →
              </Link>
            )}
          </div>
        )}

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
