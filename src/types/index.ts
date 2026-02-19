/**
 * VibeTrace — Core TypeScript types
 */

export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

export type PlanTier = "free" | "pro" | "enterprise";

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  plan: PlanTier;
  createdAt: Date;
}

export interface Repository {
  id: string;
  userId: string;
  url: string;
  name: string;
  provider: "github" | "gitlab" | "bitbucket";
  isPrivate: boolean;
  lastScannedAt?: Date;
  defaultBranch: string;
}

export interface Scan {
  id: string;
  repositoryId: string;
  userId: string;
  status: "queued" | "running" | "complete" | "failed";
  branch: string;
  commit?: string;
  startedAt: Date;
  completedAt?: Date;
  summary: ScanSummary;
}

export interface ScanSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  score: number; // 0-100 security score
}

export interface Vulnerability {
  id: string;
  scanId: string;
  severity: SeverityLevel;
  title: string;
  description: string;
  file?: string;
  line?: number;
  column?: number;
  cve?: string;
  cweId?: string;
  cvssScore?: number;
  remediation?: string;
  references?: string[];
  type: "sast" | "sca" | "secret" | "dast" | "iac";
  status: "open" | "fixed" | "accepted" | "false_positive";
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  ok: boolean;
}
