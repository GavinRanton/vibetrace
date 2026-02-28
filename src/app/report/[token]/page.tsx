import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ShieldCheck } from "lucide-react";

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};
export const dynamic = "force-dynamic";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

type ReportPageProps = {
  params: Promise<{ token: string }>;
};

type Finding = {
  id: string;
  severity: string;
  category: string;
  rule_id: string | null;
  file_path: string;
  line_number: number | null;
  plain_english: string;
  business_impact: string | null;
  fix_prompt: string | null;
  verification_step: string | null;
};

const severityClasses: Record<string, string> = {
  critical: "bg-red-500/10 text-red-300 border-red-500/30",
  high: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  medium: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  low: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  info: "bg-white/10 text-white/70 border-white/20",
};

export default async function SharedReportPage({ params }: ReportPageProps) {
  const { token } = await params;

  const { data: scan, error: scanError } = await adminClient
    .from("scans")
    .select(
      `
      id,
      status,
      score,
      total_findings,
      critical_count,
      high_count,
      medium_count,
      low_count,
      created_at,
      completed_at,
      is_shared,
      share_token,
      repos ( full_name )
    `
    )
    .eq("share_token", token)
    .eq("is_shared", true)
    .single();

  if (scanError || !scan) {
    notFound();
  }

  const { data: findingsData } = await adminClient
    .from("findings")
    .select(
      "id, severity, category, rule_id, file_path, line_number, plain_english, business_impact, fix_prompt, verification_step"
    )
    .eq("scan_id", scan.id)
    .order("created_at", { ascending: true });

  const findings: Finding[] = findingsData ?? [];
  const target = (scan.repos as { full_name?: string } | null)?.full_name ?? "URL scan";
  const displayTarget = target.startsWith("url-scan/") ? target.replace("url-scan/", "") : target;
  const completedAt = scan.completed_at ?? scan.created_at;

  return (
    <main className="min-h-screen bg-[#0A0A0F] text-white">
      <div className="max-w-5xl mx-auto px-4 py-10 md:py-14">
        <div className="mb-8">
          <p className="text-[#3B82F6] text-xs uppercase tracking-[0.15em] font-semibold">Shared Security Report</p>
          <h1 className="text-3xl font-semibold mt-2">{displayTarget}</h1>
          <p className="text-white/40 text-sm mt-2">
            Completed on {new Date(completedAt).toLocaleString()}.
          </p>
        </div>

        <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
            <p className="text-white/40 text-xs uppercase tracking-wider">Score</p>
            <p className="text-2xl font-semibold mt-1">{scan.score ?? "-"}/100</p>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
            <p className="text-white/40 text-xs uppercase tracking-wider">Findings</p>
            <p className="text-2xl font-semibold mt-1">{scan.total_findings ?? findings.length}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
            <p className="text-white/40 text-xs uppercase tracking-wider">Critical</p>
            <p className="text-2xl font-semibold mt-1 text-red-300">{scan.critical_count ?? 0}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
            <p className="text-white/40 text-xs uppercase tracking-wider">High</p>
            <p className="text-2xl font-semibold mt-1 text-amber-300">{scan.high_count ?? 0}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/10 rounded-lg p-4">
            <p className="text-white/40 text-xs uppercase tracking-wider">Medium/Low</p>
            <p className="text-2xl font-semibold mt-1 text-blue-300">
              {(scan.medium_count ?? 0) + (scan.low_count ?? 0)}
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Findings</h2>
          {findings.length === 0 ? (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-emerald-300">
              <ShieldCheck className="w-5 h-5" />
              <span>No findings recorded for this scan.</span>
            </div>
          ) : (
            findings.map((finding) => {
              const sevClass = severityClasses[finding.severity] ?? severityClasses.low;
              return (
                <article key={finding.id} className="bg-white/[0.03] border border-white/10 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-1 rounded border text-xs uppercase tracking-wider ${sevClass}`}>
                      {finding.severity}
                    </span>
                    <span className="text-white/40 text-xs uppercase tracking-wider">{finding.category}</span>
                    {finding.rule_id && <span className="text-white/30 text-xs font-mono">{finding.rule_id}</span>}
                  </div>

                  <p className="text-white/90 text-sm">{finding.plain_english}</p>

                  {finding.business_impact && (
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Business impact</p>
                      <p className="text-white/70 text-sm">{finding.business_impact}</p>
                    </div>
                  )}

                  {finding.fix_prompt && (
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Fix prompt</p>
                      <pre className="bg-black/30 border border-white/10 rounded p-3 text-xs text-white/75 whitespace-pre-wrap break-words">
                        {finding.fix_prompt}
                      </pre>
                    </div>
                  )}

                  {finding.verification_step && (
                    <div>
                      <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Verification step</p>
                      <p className="text-white/70 text-sm">{finding.verification_step}</p>
                    </div>
                  )}

                  <p className="text-white/25 text-xs font-mono">
                    {finding.file_path}
                    {finding.line_number ? `:${finding.line_number}` : ""}
                  </p>
                </article>
              );
            })
          )}
        </section>

        <footer className="mt-12 border-t border-white/10 pt-6 text-center text-sm text-white/50">
          Powered by VibeTrace -{" "}
          <Link href="/signup" className="text-[#60A5FA] hover:text-[#93C5FD]">
            scan your own site free
          </Link>
        </footer>
      </div>
    </main>
  );
}
