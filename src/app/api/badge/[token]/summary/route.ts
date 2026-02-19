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
  const hasData = score !== null;
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
  <meta property="og:title" content="${repoName} Security Summary | VibeTrace">
  <meta property="og:description" content="VibeTrace Security Score: ${score ?? 'N/A'}/100 — ${scoreLabel}">
  <meta property="og:image" content="${badgeUrl}">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0F172A;
      color: #E2E8F0;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: #1E293B;
      border: 1px solid #334155;
      border-radius: 16px;
      padding: 48px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .logo { font-size: 22px; font-weight: 800; margin-bottom: 32px; letter-spacing: -0.5px; }
    .logo .blue { color: #3B82F6; }
    .logo .white { color: #F1F5F9; }
    .score-circle {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      border: 6px solid ${scoreColor};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
      background: #0F172A;
      box-shadow: 0 0 40px ${scoreColor}20;
    }
    .score-number { font-size: 52px; font-weight: 800; color: ${scoreColor}; line-height: 1; }
    .score-denom { font-size: 14px; color: #64748B; margin-top: 2px; }
    .score-label { font-size: 20px; font-weight: 700; color: ${scoreColor}; margin-bottom: 8px; }
    .repo-name { font-size: 15px; color: #94A3B8; margin-bottom: 24px; font-family: monospace; }
    .scan-date {
      background: #0F172A;
      border-radius: 8px;
      padding: 12px 20px;
      font-size: 13px;
      color: #64748B;
      margin-bottom: 32px;
      border: 1px solid #1E293B;
    }
    .scan-date strong { color: #94A3B8; }
    .badge-embed {
      background: #0F172A;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      border: 1px solid #1E293B;
    }
    .badge-embed-label { font-size: 10px; color: #475569; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px; }
    .badge-preview { margin-bottom: 10px; }
    .badge-code {
      background: #0F172A;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 10px;
      font-family: 'Courier New', monospace;
      color: #64748B;
      word-break: break-all;
      text-align: left;
      white-space: pre-wrap;
    }
    .footer { font-size: 12px; color: #475569; line-height: 1.6; }
    .footer a { color: #3B82F6; text-decoration: none; }
    .verified-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #1D4ED820;
      border: 1px solid #3B82F640;
      color: #60A5FA;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 20px;
      margin-bottom: 24px;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo"><span class="blue">Vibe</span><span class="white">Trace</span></div>
    
    ${hasData ? `
    <div class="verified-chip">🛡 SECURITY VERIFIED</div>
    
    <div class="score-circle">
      <div class="score-number">${score}</div>
      <div class="score-denom">/ 100</div>
    </div>
    <div class="score-label">${scoreLabel}</div>
    <div class="repo-name">${repoName}</div>
    <div class="scan-date">Last scanned: <strong>${dateStr}</strong></div>
    ` : `
    <div style="padding:32px 0;">
      <div style="font-size:56px;margin-bottom:16px;">🔒</div>
      <div style="font-size:18px;color:#E2E8F0;margin-bottom:8px;font-weight:600;">${repoName}</div>
      <div style="color:#64748B;font-size:14px;">${scoreLabel} — No recent scan data</div>
      ${lastScanned ? `<div style="color:#475569;font-size:12px;margin-top:8px;">Last scan: ${dateStr}</div>` : ''}
    </div>
    `}
    
    <div class="badge-embed">
      <div class="badge-embed-label">Embed this badge in your README</div>
      <div class="badge-preview"><img src="${badgeUrl}" alt="VibeTrace Security Badge"></div>
      <div class="badge-code">[![VibeTrace](${badgeUrl})](${APP_URL}/api/badge/${badgeToken}/summary)</div>
    </div>
    
    <div class="footer">
      <p>Security verified by <a href="${APP_URL}">VibeTrace</a></p>
      <p style="margin-top:4px;font-size:11px;color:#334155;">Detailed findings are not publicly disclosed for security reasons.</p>
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

    // Look up badge by token
    const { data: badge, error: badgeError } = await adminClient
      .from('badges')
      .select('id, repo_id, user_id, is_active')
      .eq('token', token)
      .single();

    if (badgeError || !badge) {
      const html = buildSummaryHtml('Unknown Repository', null, null, token);
      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' },
      });
    }

    // Get repo name
    const { data: repo } = await adminClient
      .from('repos')
      .select('name, full_name')
      .eq('id', badge.repo_id)
      .single();

    // Get latest completed scan
    const { data: latestScan } = await adminClient
      .from('scans')
      .select('score, completed_at')
      .eq('repo_id', badge.repo_id)
      .eq('status', 'complete')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    // Check if scan is recent (within 30 days)
    const isRecent = latestScan?.completed_at
      ? (Date.now() - new Date(latestScan.completed_at).getTime()) < 30 * 24 * 60 * 60 * 1000
      : false;

    const html = buildSummaryHtml(
      repo?.full_name || repo?.name || 'Unknown Repository',
      badge.is_active && isRecent ? latestScan?.score ?? null : null,
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
    return new NextResponse('<html><body><p>Error loading summary</p></body></html>', {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
