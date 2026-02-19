import type { SemgrepFinding } from "./semgrep";

interface TranslatedFinding {
  plain_english: string;
  business_impact: string;
  fix_prompt: string;
  verification_step: string;
}

const SYSTEM_PROMPT = `You are a security expert helping non-technical founders understand vulnerabilities in their vibe-coded apps (built with Lovable, Bolt.new, or Cursor).

For each vulnerability, provide:
1. **plain_english**: A clear, non-technical explanation of what the vulnerability means. Use analogies. Example: "This is like leaving your house keys under the doormat — anyone who knows where to look can get in."
2. **business_impact**: What could happen to their users/business. Be specific but not fear-mongering. Use severity levels: Critical = "someone can access all your users data right now", High = "an attacker could exploit this with some effort", Medium = "this weakens your security posture", Low = "best practice improvement".
3. **fix_prompt**: A copy-paste prompt they can give to Lovable or Cursor to fix the issue. Be specific about the file and what needs to change. Start with "Fix the security vulnerability in..."
4. **verification_step**: After applying the fix, what should they check to confirm it worked.

Respond in JSON format only. No markdown, no explanation outside the JSON.`;

export async function translateFindings(
  findings: SemgrepFinding[],
  anthropicApiKey: string
): Promise<Map<string, TranslatedFinding>> {
  const results = new Map<string, TranslatedFinding>();

  // Process in batches of 5
  const batchSize = 5;
  for (let i = 0; i < findings.length; i += batchSize) {
    const batch = findings.slice(i, i + batchSize);
    
    const prompt = batch.map((f, idx) => `
Finding ${idx + 1}:
- Rule: ${f.check_id}
- File: ${f.path}:${f.start.line}
- Severity: ${f.extra.severity}
- Message: ${f.extra.message}
- Code: ${f.extra.lines}
`).join("\n---\n");

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5-20250514",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: `Translate these ${batch.length} security findings into plain English for a non-technical founder. Return a JSON array with objects containing: plain_english, business_impact, fix_prompt, verification_step.\n\n${prompt}`,
          }],
        }),
      });

      if (!response.ok) {
        console.error(`Claude API error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const content = data.content[0]?.text || "[]";
      
      // Parse JSON from Claude response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const translations: TranslatedFinding[] = JSON.parse(jsonMatch[0]);
        batch.forEach((finding, idx) => {
          if (translations[idx]) {
            results.set(`${finding.path}:${finding.start.line}:${finding.check_id}`, translations[idx]);
          }
        });
      }
    } catch (error) {
      console.error("Translation error:", error);
    }
  }

  return results;
}

export function calculateScore(findings: { severity: string }[]): number {
  if (findings.length === 0) return 100;

  let deductions = 0;
  for (const f of findings) {
    switch (f.severity) {
      case "critical": deductions += 25; break;
      case "high": deductions += 15; break;
      case "medium": deductions += 5; break;
      case "low": deductions += 2; break;
    }
  }

  return Math.max(0, 100 - deductions);
}
