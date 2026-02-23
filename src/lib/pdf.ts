import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vibetrace.app';

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
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

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return '#EF4444';
    case 'high': return '#F97316';
    case 'medium': return '#EAB308';
    case 'low': return '#3B82F6';
    default: return '#6B7280';
  }
}

function getSeverityBg(severity: string): string {
  switch (severity) {
    case 'critical': return '#450A0A';
    case 'high': return '#431407';
    case 'medium': return '#422006';
    case 'low': return '#1E3A5F';
    default: return '#1F2937';
  }
}

interface Finding {
  id: string;
  severity: string;
  category: string;
  rule_id: string;
  file_path: string;
  line_number: number;
  code_snippet: string;
  plain_english: string;
  business_impact: string;
  fix_prompt: string;
  verification_step: string;
  status: string;
}

interface Scan {
  id: string;
  score: number;
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  repos?: { full_name: string; name: string };
}

function buildReportHtml(scan: Scan, findings: Finding[]): string {
  const scoreColor = getScoreColor(scan.score);
  const scoreLabel = getScoreLabel(scan.score);
  const repoName = scan.repos?.full_name || 'Unknown Repository';
  const scanDate = new Date(scan.completed_at || scan.started_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  const criticalFindings = findings.filter(f => f.severity === 'critical');
  const highFindings = findings.filter(f => f.severity === 'high');
  const mediumFindings = findings.filter(f => f.severity === 'medium');
  const lowFindings = findings.filter(f => f.severity === 'low');

  const renderFindingGroup = (label: string, color: string, bg: string, items: Finding[]) => {
    if (items.length === 0) return '';
    return `
      <div class="severity-group">
        <div class="severity-header" style="border-left:4px solid ${color};background:${bg};">
          <h3 style="color:${color};margin:0;">${label} Severity (${items.length})</h3>
        </div>
        ${items.map((f, i) => `
          <div class="finding-card">
            <div class="finding-header">
              <span class="severity-badge" style="background:${color}15;color:${color};border:1px solid ${color}40;">${f.severity.toUpperCase()}</span>
              <span class="category-badge">${f.category}</span>
              <code class="rule-id">${f.rule_id}</code>
            </div>
            <div class="finding-location">
              <strong>📁 ${f.file_path}</strong>
              ${f.line_number ? `<span class="line-num">Line ${f.line_number}</span>` : ''}
            </div>
            ${f.code_snippet ? `<pre class="code-snippet">${escapeHtml(f.code_snippet)}</pre>` : ''}
            <div class="finding-section">
              <h4>What this means</h4>
              <p>${f.plain_english}</p>
            </div>
            <div class="finding-section">
              <h4>Business impact</h4>
              <p>${f.business_impact}</p>
            </div>
            <div class="finding-section fix-section">
              <h4>🔧 How to fix</h4>
              <p>${f.fix_prompt}</p>
            </div>
            ${f.verification_step ? `
            <div class="finding-section">
              <h4>✅ Verification</h4>
              <p>${f.verification_step}</p>
            </div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  };

  // SVG donut chart
  const total = scan.total_findings || 1;
  const critPct = (scan.critical_count / total) * 100;
  const highPct = (scan.high_count / total) * 100;
  const medPct = (scan.medium_count / total) * 100;
  const lowPct = (scan.low_count / total) * 100;

  function svgArc(pct: number, offset: number, color: string) {
    if (pct <= 0) return '';
    const r = 40;
    const circ = 2 * Math.PI * r;
    const dashArray = `${(pct / 100) * circ} ${circ}`;
    return `<circle cx="50" cy="50" r="${r}" fill="none" stroke="${color}" stroke-width="18" stroke-dasharray="${dashArray}" stroke-dashoffset="${-offset * circ / 100}" transform="rotate(-90 50 50)" />`;
  }

  const donutSvg = `<svg viewBox="0 0 100 100" width="140" height="140">
    <circle cx="50" cy="50" r="40" fill="none" stroke="#1E293B" stroke-width="18"/>
    ${svgArc(critPct, 0, '#EF4444')}
    ${svgArc(highPct, critPct, '#F97316')}
    ${svgArc(medPct, critPct + highPct, '#EAB308')}
    ${svgArc(lowPct, critPct + highPct + medPct, '#3B82F6')}
    <text x="50" y="46" text-anchor="middle" font-size="18" font-weight="800" fill="${scoreColor}">${scan.score}</text>
    <text x="50" y="58" text-anchor="middle" font-size="8" fill="#94A3B8">/ 100</text>
  </svg>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>VibeTrace Security Report — ${repoName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0F172A; 
    color: #E2E8F0; 
    font-size: 13px;
    line-height: 1.6;
  }
  .page { padding: 40px; max-width: 900px; margin: 0 auto; }
  
  /* Cover */
  .cover {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    page-break-after: always;
  }
  .logo { font-size: 32px; font-weight: 800; letter-spacing: -1px; }
  .logo span.blue { color: #3B82F6; }
  .logo span.white { color: #F1F5F9; }
  .tagline { color: #64748B; font-size: 14px; margin-top: 4px; }
  .cover-main { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 60px 0; }
  .report-title { font-size: 36px; font-weight: 800; color: #F1F5F9; margin-bottom: 8px; }
  .report-repo { font-size: 20px; color: #3B82F6; font-weight: 600; margin-bottom: 40px; }
  .cover-meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
  .meta-card { background: #1E293B; border-radius: 10px; padding: 20px; border: 1px solid #334155; }
  .meta-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748B; margin-bottom: 8px; }
  .meta-value { font-size: 22px; font-weight: 700; }
  .cover-footer { color: #475569; font-size: 12px; border-top: 1px solid #1E293B; padding-top: 20px; }

  /* Score section */
  .score-section {
    background: #1E293B;
    border-radius: 12px;
    padding: 32px;
    margin: 32px 0;
    display: flex;
    align-items: center;
    gap: 40px;
    border: 1px solid #334155;
  }
  .score-chart { flex-shrink: 0; }
  .score-legend { flex: 1; }
  .legend-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .legend-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
  .legend-bar-bg { flex: 1; background: #0F172A; border-radius: 4px; height: 8px; }
  .legend-bar { height: 8px; border-radius: 4px; }
  .legend-count { font-weight: 700; width: 30px; text-align: right; }
  .legend-label { width: 65px; font-size: 12px; }
  
  /* Section titles */
  .section-title {
    font-size: 20px;
    font-weight: 700;
    color: #F1F5F9;
    margin: 40px 0 20px;
    padding-bottom: 12px;
    border-bottom: 1px solid #1E293B;
  }
  
  /* Finding cards */
  .severity-group { margin-bottom: 32px; }
  .severity-header {
    padding: 12px 16px;
    border-radius: 8px 8px 0 0;
    margin-bottom: 0;
  }
  .finding-card {
    background: #1E293B;
    border: 1px solid #334155;
    border-top: none;
    padding: 20px;
    margin-bottom: 2px;
  }
  .finding-card:last-child { border-radius: 0 0 8px 8px; }
  .finding-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
  .severity-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px; }
  .category-badge { background: #334155; color: #94A3B8; font-size: 11px; padding: 2px 8px; border-radius: 4px; }
  .rule-id { background: #0F172A; color: #64748B; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
  .finding-location { margin-bottom: 12px; color: #94A3B8; font-size: 12px; display: flex; align-items: center; gap: 10px; }
  .line-num { background: #334155; padding: 1px 6px; border-radius: 3px; font-size: 11px; }
  .code-snippet { 
    background: #0F172A; 
    border: 1px solid #334155; 
    border-radius: 6px; 
    padding: 12px; 
    font-size: 11px; 
    font-family: 'Courier New', monospace; 
    color: #94A3B8; 
    overflow: hidden; 
    white-space: pre-wrap;
    word-break: break-all;
    margin-bottom: 14px;
    max-height: 120px;
  }
  .finding-section { margin-bottom: 10px; }
  .finding-section h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748B; margin-bottom: 4px; }
  .finding-section p { color: #CBD5E1; font-size: 13px; }
  .fix-section { background: #0F172A; border-radius: 6px; padding: 12px; border-left: 3px solid #3B82F6; }
  .fix-section h4 { color: #3B82F6; }
  .fix-section p { color: #93C5FD; }

  /* Summary table */
  .summary-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  .summary-table th { background: #1E293B; color: #94A3B8; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 14px; text-align: left; border-bottom: 1px solid #334155; }
  .summary-table td { padding: 10px 14px; border-bottom: 1px solid #1E293B; color: #CBD5E1; }
  .summary-table tr:hover td { background: #1E293B; }

  /* Page breaks */
  @media print {
    .findings-section { page-break-before: always; }
    .finding-card { page-break-inside: avoid; }
    .severity-group { page-break-inside: avoid; }
  }
  
  /* Confidential banner */
  .confidential {
    background: #1D4ED8;
    color: #BFDBFE;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 2px;
    text-align: center;
    padding: 8px;
    border-radius: 4px;
    margin-bottom: 32px;
  }
</style>
</head>
<body>
<div class="page">

  <!-- COVER PAGE -->
  <div class="cover">
    <div>
      <div class="logo"><span class="blue">Vibe</span><span class="white">Trace</span></div>
      <div class="tagline">Security Intelligence Platform</div>
    </div>
    
    <div class="cover-main">
      <div class="confidential">CONFIDENTIAL — SECURITY ASSESSMENT REPORT</div>
      <div class="report-title">Security Assessment Report</div>
      <div class="report-repo">${repoName}</div>
      
      <div class="cover-meta">
        <div class="meta-card">
          <div class="meta-label">Security Score</div>
          <div class="meta-value" style="color:${scoreColor};">${scan.score}<span style="font-size:14px;color:#64748B;"> / 100</span></div>
          <div style="color:${scoreColor};font-size:12px;margin-top:4px;">${scoreLabel}</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Total Findings</div>
          <div class="meta-value">${scan.total_findings}</div>
          <div style="color:#64748B;font-size:12px;margin-top:4px;">${scan.critical_count + scan.high_count} require action</div>
        </div>
        <div class="meta-card">
          <div class="meta-label">Scan Date</div>
          <div class="meta-value" style="font-size:16px;">${scanDate}</div>
          ${scan.duration_seconds ? `<div style="color:#64748B;font-size:12px;margin-top:4px;">Duration: ${scan.duration_seconds}s</div>` : ''}
        </div>
      </div>
    </div>
    
    <div class="cover-footer">
      <p>Generated by VibeTrace · ${APP_URL} · For internal use and investor due diligence only</p>
    </div>
  </div>

  <!-- EXECUTIVE SUMMARY -->
  <h2 class="section-title">Executive Summary</h2>
  
  <div class="score-section">
    <div class="score-chart">${donutSvg}</div>
    <div class="score-legend">
      <p style="color:#94A3B8;margin-bottom:16px;">Severity Breakdown</p>
      ${[
        { label: 'Critical', color: '#EF4444', count: scan.critical_count },
        { label: 'High', color: '#F97316', count: scan.high_count },
        { label: 'Medium', color: '#EAB308', count: scan.medium_count },
        { label: 'Low', color: '#3B82F6', count: scan.low_count },
      ].map(({ label, color, count }) => `
        <div class="legend-row">
          <div class="legend-dot" style="background:${color};"></div>
          <span class="legend-label" style="color:${color};">${label}</span>
          <div class="legend-bar-bg">
            <div class="legend-bar" style="background:${color};width:${total > 0 ? Math.round((count/total)*100) : 0}%;"></div>
          </div>
          <span class="legend-count">${count}</span>
        </div>
      `).join('')}
    </div>
  </div>

  <p style="color:#94A3B8;margin-bottom:24px;font-size:14px;">
    This report summarises the security posture of <strong style="color:#E2E8F0;">${repoName}</strong>. 
    ${scan.score >= 80 
      ? 'The repository demonstrates a strong security posture with minor areas for improvement.'
      : scan.score >= 50
        ? 'The repository has several security issues that should be addressed to improve its security posture.'
        : 'The repository has significant security vulnerabilities that require immediate attention.'
    }
  </p>

  <!-- FINDINGS TABLE -->
  ${scan.total_findings > 0 ? `
  <h2 class="section-title">Findings Summary</h2>
  <table class="summary-table">
    <thead>
      <tr>
        <th>Severity</th>
        <th>Category</th>
        <th>File</th>
        <th>Line</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${findings.map(f => `
        <tr>
          <td><span style="color:${getSeverityColor(f.severity)};font-weight:600;">${f.severity.toUpperCase()}</span></td>
          <td>${f.category}</td>
          <td style="font-family:monospace;font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.file_path}</td>
          <td>${f.line_number || '—'}</td>
          <td>${f.status}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : `<p style="color:#64748B;padding:24px;text-align:center;background:#1E293B;border-radius:8px;">No findings detected — excellent security posture!</p>`}

  <!-- DETAILED FINDINGS -->
  ${scan.total_findings > 0 ? `
  <div class="findings-section">
    <h2 class="section-title">Detailed Findings</h2>
    ${renderFindingGroup('Critical', '#EF4444', '#450A0A20', criticalFindings)}
    ${renderFindingGroup('High', '#F97316', '#43140720', highFindings)}
    ${renderFindingGroup('Medium', '#EAB308', '#42200620', mediumFindings)}
    ${renderFindingGroup('Low', '#3B82F6', '#1E3A5F20', lowFindings)}
  </div>
  ` : ''}

  <!-- FOOTER -->
  <div style="margin-top:60px;padding-top:20px;border-top:1px solid #1E293B;text-align:center;color:#475569;font-size:11px;">
    <p>VibeTrace Security Intelligence · ${APP_URL} · Report generated ${new Date().toISOString()}</p>
    <p style="margin-top:4px;">This report is confidential and intended solely for the named organisation. Do not distribute.</p>
  </div>

</div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function generateScanReport(scanId: string): Promise<Buffer> {
  const admin = getAdminClient();

  // Fetch scan data
  const { data: scan, error: scanError } = await admin
    .from('scans')
    .select('*, repos(full_name, name)')
    .eq('id', scanId)
    .single();

  if (scanError || !scan) {
    throw new Error(`Scan not found: ${scanId}`);
  }

  // Fetch findings
  const { data: findings, error: findingsError } = await admin
    .from('findings')
    .select('*')
    .eq('scan_id', scanId)
    .order('severity', { ascending: true });

  if (findingsError) {
    throw new Error(`Failed to fetch findings: ${findingsError.message}`);
  }

  const html = buildReportHtml(scan, findings || []);

  // Launch Puppeteer and generate PDF
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/snap/chromium/current/usr/lib/chromium-browser/chrome',
    protocolTimeout: 300000,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--hide-scrollbars',
      '--metrics-recording-only',
      '--mute-audio',
      '--safebrowsing-disable-auto-update',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    // Use goto with data URI — more reliable than setContent on restricted envs
    const encoded = Buffer.from(html).toString('base64');
    await page.goto('data:text/html;base64,' + encoded, {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    // Small pause to let CSS render
    await new Promise(r => setTimeout(r, 500));
    
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      printBackground: true,
      displayHeaderFooter: false,
      timeout: 120000,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
