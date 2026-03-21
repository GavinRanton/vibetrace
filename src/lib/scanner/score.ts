export function calculateScore(
  findings: Array<{ severity: string; category?: string }>
): number {
  if (findings.length === 0) return 100;

  const weights: Record<string, Record<string, number>> = {
    critical: { sast: 25, sca: 20, dast: 15, secret: 30, seo: 8 },
    high: { sast: 12, sca: 10, dast: 8, secret: 15, seo: 4 },
    medium: { sast: 5, sca: 4, dast: 3, secret: 6, seo: 2 },
    low: { sast: 2, sca: 2, dast: 1, secret: 3, seo: 1 },
    info: { sast: 0, sca: 0, dast: 0, secret: 0, seo: 0 },
  };

  let totalPenalty = 0;
  for (const finding of findings) {
    const sev = (finding.severity ?? "low").toLowerCase();
    const rawCategory = (finding.category ?? "dast").toLowerCase();
    const category =
      rawCategory === "seo" ? "seo" : rawCategory === "dast" ? "dast" : "sast";
    const deduction = weights[sev]?.[category] ?? weights[sev]?.dast ?? 0;
    totalPenalty += deduction;
  }

  return Math.max(0, Math.min(100, 100 - totalPenalty));
}
