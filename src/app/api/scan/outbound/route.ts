import { randomUUID } from "crypto";
import { after, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

import { processScan } from "@/lib/scanner/pipeline";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const DAILY_LIMIT = 100;
const RATE_LIMIT_STATE_KEY = "__vibetraceOutboundRateLimitState";

type RateLimitBucket = {
  day: string;
  count: number;
};

type RateLimitState = Map<string, RateLimitBucket>;

type GlobalWithRateLimit = typeof globalThis & {
  [RATE_LIMIT_STATE_KEY]?: RateLimitState;
};

const rateLimitState =
  (globalThis as GlobalWithRateLimit)[RATE_LIMIT_STATE_KEY] ??
  ((globalThis as GlobalWithRateLimit)[RATE_LIMIT_STATE_KEY] = new Map<string, RateLimitBucket>());

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function consumeDailyQuota(apiKey: string): boolean {
  const today = getTodayKey();
  const bucket = rateLimitState.get(apiKey);

  if (!bucket || bucket.day !== today) {
    rateLimitState.set(apiKey, { day: today, count: 1 });
    return true;
  }

  if (bucket.count >= DAILY_LIMIT) {
    return false;
  }

  bucket.count += 1;
  return true;
}

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

function isValidRepoFullName(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.trim());
}

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export async function POST(request: NextRequest) {
  try {
    const configuredApiKey = process.env.VIBETRACE_OUTBOUND_API_KEY?.trim();
    const outboundUserId = process.env.VIBETRACE_OUTBOUND_USER_ID?.trim();

    if (!configuredApiKey || !outboundUserId) {
      return NextResponse.json(
        { error: "server_misconfigured", message: "Outbound scan API is not configured" },
        { status: 500 }
      );
    }

    const incomingApiKey = getBearerToken(request);
    if (!incomingApiKey || incomingApiKey !== configuredApiKey) {
      return NextResponse.json(
        { error: "invalid_api_key", message: "API key is invalid or expired" },
        { status: 401 }
      );
    }

    if (!consumeDailyQuota(incomingApiKey)) {
      return NextResponse.json(
        { error: "rate_limit_exceeded", message: "Too many scans from this source. Limit: 100/day" },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const repoFullName = body?.repo_full_name;
    const ownerEmail = body?.owner_email;

    if (!isValidRepoFullName(repoFullName)) {
      return NextResponse.json(
        { error: "invalid_repo", message: "Repository not found or not accessible" },
        { status: 400 }
      );
    }

    if (!isValidEmail(ownerEmail)) {
      return NextResponse.json(
        { error: "invalid_owner_email", message: "owner_email must be a valid email address" },
        { status: 400 }
      );
    }

    const trimmedRepoFullName = repoFullName.trim();
    const trimmedOwnerEmail = ownerEmail.trim().toLowerCase();

    const { data: systemUser, error: systemUserError } = await adminClient
      .from("users")
      .select("id, github_access_token")
      .eq("id", outboundUserId)
      .single();

    if (systemUserError || !systemUser) {
      return NextResponse.json(
        { error: "invalid_outbound_user", message: "Outbound system user is not configured" },
        { status: 500 }
      );
    }

    const githubToken = systemUser.github_access_token as string | null;
    if (!githubToken || githubToken.startsWith("ghu_")) {
      return NextResponse.json(
        { error: "missing_github_token", message: "Outbound system user is missing a valid GitHub token" },
        { status: 500 }
      );
    }

    const repoName = trimmedRepoFullName.split("/")[1] ?? trimmedRepoFullName;
    const { data: repoRecord, error: repoError } = await adminClient
      .from("repos")
      .upsert(
        {
          user_id: outboundUserId,
          github_repo_id: `outbound:${trimmedRepoFullName.toLowerCase()}`,
          name: repoName,
          full_name: trimmedRepoFullName,
          is_private: false,
        },
        { onConflict: "user_id,github_repo_id" }
      )
      .select("id")
      .single();

    if (repoError || !repoRecord) {
      return NextResponse.json(
        { error: "repo_registration_failed", message: "Failed to register repository" },
        { status: 500 }
      );
    }

    const shareToken = randomUUID();
    const { data: scanRecord, error: scanError } = await adminClient
      .from("scans")
      .insert({
        repo_id: repoRecord.id,
        user_id: outboundUserId,
        status: "cloning",
        started_at: new Date().toISOString(),
        share_token: shareToken,
        is_shared: true,
      })
      .select("id, status, share_token")
      .single();

    if (scanError || !scanRecord) {
      return NextResponse.json(
        { error: "scan_create_failed", message: "Failed to create outbound scan" },
        { status: 500 }
      );
    }

    after(() => processScan(scanRecord.id, trimmedRepoFullName, githubToken, outboundUserId, repoRecord.id));

    const token = scanRecord.share_token ?? shareToken;

    return NextResponse.json(
      {
        scan_id: scanRecord.id,
        share_token: token,
        share_url: `https://vibetrace.app/report/${token}`,
        status: "started",
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Outbound scan error:", error);
    const message = error instanceof Error ? error.message : "Outbound scan failed";
    return NextResponse.json(
      { error: "outbound_scan_failed", message },
      { status: 500 }
    );
  }
}
