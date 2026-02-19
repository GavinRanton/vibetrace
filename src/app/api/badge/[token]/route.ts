import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vibetrace.app';

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function getBadgeColor(score: number | null, isActive: boolean): { fill: string; text: string; label: string } {
  if (!isActive || score === null) {
    return { fill: '#4B5563', text: '#9CA3AF', label: 'Unverified' };
  }
  if (score >= 80) return { fill: '#15803D', text: '#BBF7D0', label: 'Secure' };
  if (score >= 50) return { fill: '#92400E', text: '#FDE68A', label: 'Needs Review' };
  return { fill: '#991B1B', text: '#FECACA', label: 'At Risk' };
}

function buildSvgBadge(
  score: number | null,
  lastScanned: string | null,
  isActive: boolean,
  summaryUrl: string
): string {
  const { fill, text, label } = getBadgeColor(score, isActive);
  const dateStr = lastScanned
    ? new Date(lastScanned).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Never';
  const scoreStr = score !== null && isActive ? `${score}/100` : '—';

  const leftWidth = 110;
  const rightWidth = 130;
  const totalWidth = leftWidth + rightWidth;
  const height = 28;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}" role="img" aria-label="VibeTrace Security Badge">
  <title>VibeTrace Security — ${label}</title>
  <defs>
    <linearGradient id="bg-left" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1D4ED8"/>
      <stop offset="100%" stop-color="#1E40AF"/>
    </linearGradient>
    <linearGradient id="bg-right" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${fill}"/>
      <stop offset="100%" stop-color="${fill}dd"/>
    </linearGradient>
    <mask id="rounded">
      <rect width="${totalWidth}" height="${height}" rx="4" ry="4" fill="white"/>
    </mask>
  </defs>
  <g mask="url(#rounded)">
    <rect width="${leftWidth}" height="${height}" fill="url(#bg-left)"/>
    <rect x="${leftWidth}" width="${rightWidth}" height="${height}" fill="url(#bg-right)"/>
    <line x1="${leftWidth}" y1="0" x2="${leftWidth}" y2="${height}" stroke="rgba(0,0,0,0.2)" stroke-width="1"/>
    <text x="8" y="18" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="11" font-weight="700" fill="#BFDBFE" letter-spacing="0.3">&#x1F6E1; VibeTrace</text>
    <text x="${leftWidth + 8}" y="12" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="9" font-weight="700" fill="${text}">${label} · ${scoreStr}</text>
    <text x="${leftWidth + 8}" y="22" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" font-size="8" fill="${text}bb">Scanned ${dateStr}</text>
  </g>
  <a href="${summaryUrl}">
    <rect width="${totalWidth}" height="${height}" fill="transparent" rx="4"/>
  </a>
</svg>`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const summaryUrl = `${APP_URL}/api/badge/${token}/summary`;

    // Look up badge by token (public read policy allows this)
    const { data: badge, error: badgeError } = await adminClient
      .from('badges')
      .select('id, repo_id, user_id, last_score, last_verified_at, is_active')
      .eq('token', token)
      .single();

    if (badgeError || !badge) {
      const svg = buildSvgBadge(null, null, false, summaryUrl);
      return new NextResponse(svg, {
        headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache, max-age=0' },
      });
    }

    // Check if user has active paid plan
    const { data: user } = await adminClient
      .from('users')
      .select('plan')
      .eq('id', badge.user_id)
      .single();

    const hasPaidPlan = user?.plan !== 'free';

    // Get latest completed scan for this repo
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

    const isActive = badge.is_active && isRecent;
    const score = isActive ? (latestScan?.score ?? null) : null;

    // Update badge cache
    if (latestScan?.score !== undefined) {
      await adminClient
        .from('badges')
        .update({ last_score: latestScan.score, last_verified_at: new Date().toISOString() })
        .eq('id', badge.id);
    }

    const svg = buildSvgBadge(score, latestScan?.completed_at || null, isActive, summaryUrl);

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (err: any) {
    console.error('[VibeTrace] Badge error:', err);
    const svg = buildSvgBadge(null, null, false, APP_URL);
    return new NextResponse(svg, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-cache' },
    });
  }
}
