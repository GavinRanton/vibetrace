import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatSeverity(severity: string): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1).toLowerCase();
}

export function severityToColor(severity: string): string {
  const map: Record<string, string> = {
    critical: "#EF4444",
    high: "#F59E0B",
    medium: "#3B82F6",
    low: "#10B981",
    none: "#6B7280",
  };
  return map[severity.toLowerCase()] ?? "#6B7280";
}

export function truncateUrl(url: string, maxLen = 50): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + "...";
}
