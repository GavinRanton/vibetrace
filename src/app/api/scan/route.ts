import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cloneRepo, runSemgrepScan, cleanupRepo, mapSeverity, categoriseFinding } from "@/lib/scanner/semgrep";
import { translateFindings, calculateScore } from "@/lib/scanner/translate";

// Admin client for writing scan results (bypasses RLS)
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { repo_id, repo_full_name } = body;

    if (!repo_id || !repo_full_name) {
      return NextResponse.json({ error: "Missing repo_id or repo_full_name" }, { status: 400 });
    }

    const githubToken = session.provider_token;
    if (!githubToken) {
      return NextResponse.json({ error: "No GitHub token — please re-authenticate" }, { status: 401 });
    }

    // Check plan limits
    const { data: user } = await adminClient
      .from("users")
      .select("plan, scan_count")
      .eq("id", session.user.id)
      .single();

    if (user?.plan === "free" && user?.scan_count >= 1) {
      return NextResponse.json({ error: "Free plan limit reached. Upgrade to scan more." }, { status: 403 });
    }

    // Create scan record
    const { data: scan, error: scanError } = await adminClient
      .from("scans")
      .insert({
        repo_id,
        user_id: session.user.id,
        status: "cloning",
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (scanError || !scan) {
      return NextResponse.json({ error: "Failed to create scan" }, { status: 500 });
    }

    // Run scan asynchronously (respond immediately, process in background)
    processScan(scan.id, repo_full_name, githubToken, session.user.id);

    return NextResponse.json({ scan_id: scan.id, status: "started" });
  } catch (error: any) {
    console.error("Scan error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function processScan(
  scanId: string,
  repoFullName: string,
  githubToken: string,
  userId: string
) {
  let repoPath: string | null = null;

  try {
    // Clone repo
    await adminClient.from("scans").update({ status: "cloning" }).eq("id", scanId);
    repoPath = await cloneRepo(repoFullName, githubToken);

    // Run Semgrep
    await adminClient.from("scans").update({ status: "scanning" }).eq("id", scanId);
    const scanResult = await runSemgrepScan(repoPath);

    // Translate findings with Claude
    await adminClient.from("scans").update({ status: "translating" }).eq("id", scanId);
    const translations = await translateFindings(
      scanResult.findings,
      process.env.ANTHROPIC_API_KEY || ""
    );

    // Map and insert findings
    const mappedFindings = scanResult.findings.map((f) => {
      const key = `${f.path}:${f.start.line}:${f.check_id}`;
      const translation = translations.get(key);
      const severity = mapSeverity(f.extra.severity);

      return {
        scan_id: scanId,
        severity,
        category: categoriseFinding(f.check_id),
        rule_id: f.check_id,
        file_path: f.path,
        line_number: f.start.line,
        code_snippet: f.extra.lines,
        raw_output: f,
        plain_english: translation?.plain_english || f.extra.message,
        business_impact: translation?.business_impact || `${severity} severity finding`,
        fix_prompt: translation?.fix_prompt || `Fix the issue in ${f.path} at line ${f.start.line}`,
        verification_step: translation?.verification_step || "Re-run the scan to verify the fix",
        status: "open",
      };
    });

    if (mappedFindings.length > 0) {
      await adminClient.from("findings").insert(mappedFindings);
    }

    // Calculate score and update scan
    const score = calculateScore(mappedFindings);
    const counts = {
      critical: mappedFindings.filter(f => f.severity === "critical").length,
      high: mappedFindings.filter(f => f.severity === "high").length,
      medium: mappedFindings.filter(f => f.severity === "medium").length,
      low: mappedFindings.filter(f => f.severity === "low").length,
    };

    await adminClient.from("scans").update({
      status: "complete",
      score,
      total_findings: mappedFindings.length,
      critical_count: counts.critical,
      high_count: counts.high,
      medium_count: counts.medium,
      low_count: counts.low,
      duration_seconds: Math.round(scanResult.duration / 1000),
      completed_at: new Date().toISOString(),
    }).eq("id", scanId);

    // Update user scan count
    await adminClient.rpc("increment_scan_count", { user_id: userId });

    // Update repo last scanned
    await adminClient.from("repos").update({ last_scanned_at: new Date().toISOString() }).eq("id", scanResult);

  } catch (error: any) {
    console.error("Scan processing error:", error);
    await adminClient.from("scans").update({
      status: "failed",
      error_message: error.message,
      completed_at: new Date().toISOString(),
    }).eq("id", scanId);
  } finally {
    // CRITICAL: Always cleanup cloned repo
    if (repoPath) {
      await cleanupRepo(repoPath);
      console.log(`[VibeTrace] Repo cleaned up: ${repoPath}`);
    }
  }
}
