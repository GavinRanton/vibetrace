import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vibetrace.app';
const FROM_ADDRESS = 'VibeTrace <scans@vibetrace.app>';

export interface ScanResult {
  scan_id: string;
  repo_name: string;
  score: number;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  completed_at: string;
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#EF4444';
    case 'high': return '#F97316';
    case 'medium': return '#EAB308';
    case 'low': return '#3B82F6';
    default: return '#6B7280';
  }
}

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

function buildEmailHtml(to: string, result: ScanResult): string {
  const scoreColor = getScoreColor(result.score);
  const scoreLabel = getScoreLabel(result.score);
  const dashboardUrl = `${APP_URL}/dashboard/scans/${result.scan_id}`;
  const formattedDate = new Date(result.completed_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VibeTrace Scan Complete</title>
</head>
<body style="margin:0;padding:0;background-color:#0F172A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#E2E8F0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0F172A;min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          
          <!-- Header -->
          <tr>
            <td style="background:#1E293B;border-radius:12px 12px 0 0;padding:32px 40px;border-bottom:1px solid #334155;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:24px;font-weight:800;color:#3B82F6;letter-spacing:-0.5px;">Vibe</span><span style="font-size:24px;font-weight:800;color:#E2E8F0;letter-spacing:-0.5px;">Trace</span>
                    <p style="margin:4px 0 0;font-size:13px;color:#64748B;">Security Intelligence Platform</p>
                  </td>
                  <td align="right">
                    <span style="background:#1D4ED8;color:#BFDBFE;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;letter-spacing:0.5px;">SCAN COMPLETE</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Score Card -->
          <tr>
            <td style="background:#1E293B;padding:40px;">
              <p style="margin:0 0 8px;font-size:14px;color:#94A3B8;">Repository scanned</p>
              <h1 style="margin:0 0 32px;font-size:22px;font-weight:700;color:#F1F5F9;">${result.repo_name}</h1>
              
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="140" align="center" style="background:#0F172A;border-radius:12px;padding:24px;border:1px solid #334155;">
                    <div style="font-size:56px;font-weight:800;color:${scoreColor};line-height:1;">${result.score}</div>
                    <div style="font-size:11px;color:#64748B;margin-top:4px;letter-spacing:1px;text-transform:uppercase;">/ 100</div>
                    <div style="font-size:13px;font-weight:600;color:${scoreColor};margin-top:8px;">${scoreLabel}</div>
                  </td>
                  <td style="padding-left:24px;">
                    <p style="margin:0 0 16px;font-size:14px;color:#94A3B8;">Findings by severity</p>
                    
                    ${result.critical_count > 0 ? `
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                      <tr>
                        <td style="font-size:13px;color:#EF4444;font-weight:600;width:70px;">Critical</td>
                        <td style="padding:0 8px;">
                          <div style="background:#1F2937;border-radius:4px;height:8px;overflow:hidden;">
                            <div style="background:#EF4444;height:8px;width:${Math.min(100, result.critical_count * 20)}%;border-radius:4px;"></div>
                          </div>
                        </td>
                        <td style="font-size:13px;color:#E2E8F0;font-weight:700;width:30px;text-align:right;">${result.critical_count}</td>
                      </tr>
                    </table>` : ''}
                    
                    ${result.high_count > 0 ? `
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                      <tr>
                        <td style="font-size:13px;color:#F97316;font-weight:600;width:70px;">High</td>
                        <td style="padding:0 8px;">
                          <div style="background:#1F2937;border-radius:4px;height:8px;overflow:hidden;">
                            <div style="background:#F97316;height:8px;width:${Math.min(100, result.high_count * 10)}%;border-radius:4px;"></div>
                          </div>
                        </td>
                        <td style="font-size:13px;color:#E2E8F0;font-weight:700;width:30px;text-align:right;">${result.high_count}</td>
                      </tr>
                    </table>` : ''}
                    
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                      <tr>
                        <td style="font-size:13px;color:#EAB308;font-weight:600;width:70px;">Medium</td>
                        <td style="padding:0 8px;">
                          <div style="background:#1F2937;border-radius:4px;height:8px;overflow:hidden;">
                            <div style="background:#EAB308;height:8px;width:${Math.min(100, result.medium_count * 5)}%;border-radius:4px;"></div>
                          </div>
                        </td>
                        <td style="font-size:13px;color:#E2E8F0;font-weight:700;width:30px;text-align:right;">${result.medium_count}</td>
                      </tr>
                    </table>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:13px;color:#3B82F6;font-weight:600;width:70px;">Low</td>
                        <td style="padding:0 8px;">
                          <div style="background:#1F2937;border-radius:4px;height:8px;overflow:hidden;">
                            <div style="background:#3B82F6;height:8px;width:${Math.min(100, result.low_count * 5)}%;border-radius:4px;"></div>
                          </div>
                        </td>
                        <td style="font-size:13px;color:#E2E8F0;font-weight:700;width:30px;text-align:right;">${result.low_count}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Stats Row -->
          <tr>
            <td style="background:#162032;padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="background:#0F172A;border-radius:8px;padding:16px;border:1px solid #1E293B;">
                    <div style="font-size:28px;font-weight:700;color:#E2E8F0;">${result.total_findings}</div>
                    <div style="font-size:11px;color:#64748B;margin-top:2px;letter-spacing:0.5px;text-transform:uppercase;">Total Findings</div>
                  </td>
                  <td width="8"></td>
                  <td align="center" style="background:#0F172A;border-radius:8px;padding:16px;border:1px solid #1E293B;">
                    <div style="font-size:28px;font-weight:700;color:#EF4444;">${result.critical_count + result.high_count}</div>
                    <div style="font-size:11px;color:#64748B;margin-top:2px;letter-spacing:0.5px;text-transform:uppercase;">Action Required</div>
                  </td>
                  <td width="8"></td>
                  <td align="center" style="background:#0F172A;border-radius:8px;padding:16px;border:1px solid #1E293B;">
                    <div style="font-size:12px;font-weight:600;color:#E2E8F0;">${formattedDate}</div>
                    <div style="font-size:11px;color:#64748B;margin-top:2px;letter-spacing:0.5px;text-transform:uppercase;">Completed At</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- CTA -->
          <tr>
            <td style="background:#1E293B;padding:32px 40px;text-align:center;border-top:1px solid #334155;">
              <a href="${dashboardUrl}" style="display:inline-block;background:#3B82F6;color:#FFFFFF;font-size:15px;font-weight:600;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">View Full Report →</a>
              <p style="margin:16px 0 0;font-size:13px;color:#475569;">Fix findings, download PDF report, and track your security progress.</p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background:#0F172A;border-radius:0 0 12px 12px;padding:24px 40px;text-align:center;border-top:1px solid #1E293B;">
              <p style="margin:0;font-size:12px;color:#475569;">
                You received this because you ran a VibeTrace security scan.<br>
                <a href="${APP_URL}/dashboard/settings" style="color:#3B82F6;text-decoration:none;">Manage notifications</a> · 
                <a href="${APP_URL}" style="color:#3B82F6;text-decoration:none;">vibetrace.app</a>
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendScanCompleteEmail(
  to: string,
  result: ScanResult
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const scoreLabel = getScoreLabel(result.score);
    const urgency = result.critical_count > 0 
      ? `⚠️ ${result.critical_count} critical finding${result.critical_count !== 1 ? 's' : ''} require immediate attention`
      : result.high_count > 0
        ? `${result.high_count} high severity finding${result.high_count !== 1 ? 's' : ''} found`
        : 'Scan complete — review your results';

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject: `[VibeTrace] ${result.repo_name} — Score: ${result.score}/100 (${scoreLabel})`,
      html: buildEmailHtml(to, result),
      text: `VibeTrace Scan Complete\n\nRepository: ${result.repo_name}\nSecurity Score: ${result.score}/100 (${scoreLabel})\n\nFindings:\n- Critical: ${result.critical_count}\n- High: ${result.high_count}\n- Medium: ${result.medium_count}\n- Low: ${result.low_count}\n- Total: ${result.total_findings}\n\n${urgency}\n\nView full report: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/scans/${result.scan_id}\n\n— VibeTrace`,
    });

    if (error) {
      console.error('[VibeTrace] Email send error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err: any) {
    console.error('[VibeTrace] Email exception:', err);
    return { success: false, error: err.message };
  }
}
