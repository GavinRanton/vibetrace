import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendScanCompleteEmail } from '@/lib/email';

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    // Verify internal secret to prevent abuse (optional but recommended)
    const authHeader = request.headers.get('x-internal-secret');
    if (process.env.INTERNAL_SECRET && authHeader !== process.env.INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { scan_id, to } = body;

    if (!scan_id) {
      return NextResponse.json({ error: 'Missing scan_id' }, { status: 400 });
    }

    // Fetch scan data
    const { data: scan, error: scanError } = await adminClient
      .from('scans')
      .select('*, repos(full_name, name)')
      .eq('id', scan_id)
      .single();

    if (scanError || !scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    // Get user email if not provided
    let emailTo = to;
    if (!emailTo) {
      const { data: user } = await adminClient
        .from('users')
        .select('email')
        .eq('id', scan.user_id)
        .single();
      emailTo = user?.email;
    }

    if (!emailTo) {
      return NextResponse.json({ error: 'No email address found' }, { status: 400 });
    }

    const result = await sendScanCompleteEmail(emailTo, {
      scan_id: scan.id,
      repo_name: scan.repos?.full_name || 'Unknown Repository',
      score: scan.score || 0,
      total_findings: scan.total_findings || 0,
      critical_count: scan.critical_count || 0,
      high_count: scan.high_count || 0,
      medium_count: scan.medium_count || 0,
      low_count: scan.low_count || 0,
      completed_at: scan.completed_at || scan.started_at,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, email_id: result.id });
  } catch (err: any) {
    console.error('[VibeTrace] Email route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
