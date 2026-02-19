import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vibetrace.app';

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function getScoreColor(score: number): string {
  if (score >= 80) return '#22C55E';
  if (score >= 50) return '#EAB308';
  return '#EF4444';
}

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 50) return 'Needs Attention';
  return 'At Risk';
}

function buildSummaryHtml(
  repoName: string,
  score: number | null,
  lastScanned: string | null,
  badgeToken: string
): string {
  const hasData = score !== null && lastScanned;
  const scoreColor = hasData ? getScoreColor(score!) : '#6B7280';
  const scoreLabel = hasData ? getScoreLabel(score!) : 'No Data';
  const dateStr = lastScanned
    ? new Date(lastScanned).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Never scanned';
  const badgeUrl = `${APP_URL}/api/badge/${badgeToken}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${repoName} — Security Summary | VibeTrace</title>
  <meta name="description" content="Security scan summary for ${repoName} — Score: ${score ?? 'N/A'}/100">
  <meta property="og:title" content="${repoName} Security Summary">
  <meta property="og:description" content="VibeTrace Security Score: ${score ?? 'N/A'}/100 — ${scoreLabel}">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0F172A;
      color: #E2E8F0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #1E293B;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 48px;
      max-width: 480px;
      width: 100%;
      margin: 20px;
      text-align: center;
    }
    .logo { font-size: 20px; font-weight: 800; margin-bottom: 32px; }
    .logo .blue { color: #3B82F6; }
    .logo .white { color: #F1F5F9; }
    .score-circle {
      width: 140px;
      height: 140px;
      border-radius: 50%;
      border: 6px solid ${scoreColor};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      background: #0F172A;
    }
    .score-number { font-size: 48px; font-weight: 800; color: ${scoreColor}; line-height: 1; }
    .score-denom { font-size: 14px; color: #64748B; }
    .score-label { font-size: 18px; font-weight: 600; color: ${scoreColor}; margin-bottom: 8px; }
    .repo-name { font-size: 16px; color: #94A3B8; margin-bottom: 24px; }
    .scan-date {
      background: #0F172A;
      border-radius: 8px;
      padding: 12px 20px;
      font-size: 13px;
      color: #64748B;
      margin-bottom: 32px;
    }
    .scan-date span { color: #94A3B8; font-weight: 600; }
    .badge-embed {
      background: #0F172A;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      border: 1px solid #1E293B;
    }
    .badge-embed p { font-size: 11px; color: #475569; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .badge-code {
      background: #0F172A;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 11px;
      font-family: monospace;
      color: #64748B;
      word-break: break-all;
      text-align: left;
    }
    .footer { font-size: 12px; color: #475569; }
    .footer a { color: #3B82F6; text-decoration: none; }
    .no-data { color: #64748B; font-size: 14px; padding: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo"><span class="blue">Vibe</span><span class="white">Trace</span></div>
    
    ${hasData ? `
    <div class="score-circle">
      <div class="score-number">${score}</div>
      <div class="score-denom">/ 100</div>
    </div>
    <div class="score-label">${scoreLabel}</div>
    <div class="repo-name">${repoName}</div>
    <div class="scan-date">Last scanned: <span>${dateStr}</span></div>
    ` : `
    <div class="no-data">
      <p style="font-size:48px;margin-bottom:16px;">🔒</p>
      <p style="font-size:18px;color:#E2E8F0;margin-bottom:8px;">${repoName}</p>
      <p>${scoreLabel} — No scan data available</p>
    </div>
    `}
    
    <div class="badge-embed">
      <p>Embed this badge</p>
      <img src="${badgeUrl}" alt="VibeTrace Security Badge" style="margin-bottom:8px;display:block;">
      <div class="badge-code">[![VibeTrace](${badgeUrl})](${APP_URL}/api/badge/${badgeToken}/summary)</div>
    </div>
    
    <div class="footer">
      <p>Verified by <a href="${APP_URL}">VibeTrace</a> · Security intelligence for developers</p>
      <p style="margin-top:4px;font-size:11px;color:#334155;">Note: Detailed findings are not publicly disclosed</p>
    </div>
  </div>
</body>
</html>`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Look up repo by badge token
    const { data: repo, error: repoError } = await adminClient
      .from('repos')
      .select('id, name, full_name')
      .eq('badge_token', token)
      .single();

    if (repoError || !repo) {
      const html = buildSummaryHtml('Unknown Repository', null, null, token);
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' },
      });
    }

    // Get latest completed scan
    const { data: latestScan } = await adminClient
      .from('scans')
      .select('score, completed_at, total_findings')
      .eq('repo_id', repo.id)
      .eq('status', 'complete')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    // Check if scan is recent (within 30 days)
    const isRecent = latestScan?.completed_at
      ? (Date.now() - new Date(latestScan.completed_at).getTime()) < 30 * 24 * 60 * 60 * 1000
      : false;

    const html = buildSummaryHtml(
      repo.full_name || repo.name,
      isRecent ? latestScan?.score ?? null : null,
      latestScan?.completed_at || null,
      token
    );

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    console.error('[VibeTrace] Badge summary error:', err);
    return new NextResponse('<p>Error loading summary</p>', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
