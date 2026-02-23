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
3. **fix_prompt**: A complete message the user can copy and paste directly into Lovable, Cursor, or ChatGPT to fix their code. CRITICAL RULES:
   - Do NOT mention file paths, line numbers, or server directories
   - Do NOT use technical jargon the user would not understand
   - Write it in first person as if the user is speaking to their AI tool
   - Start with: "In Lovable (or Cursor), paste this exactly:\n\""
   - End with closing quote and period
   - Be specific about WHAT the vulnerability is and HOW to fix it in plain language
   - The prompt should work even if the user does not know which file has the issue
4. **verification_step**: After applying the fix, what should they check to confirm it worked.

Examples of good fix_prompt output:

Example 1 (Hardcoded Secret):
"In Lovable (or Cursor), paste this exactly:\n\"I have a critical security issue in my app. I have hardcoded an API key directly in my code as a variable called API_KEY. This is dangerous because anyone who sees my code can steal my API key. Please find all hardcoded secrets, API keys, passwords, and tokens in my server code and move them to environment variables using process.env.VARIABLE_NAME. Also make sure .env is listed in my .gitignore file so it never gets uploaded to GitHub.\""

Example 2 (SQL Injection):
"In Lovable (or Cursor), paste this exactly:\n\"I have a SQL injection vulnerability in my app. My code is building database queries by joining strings together with user input, which lets attackers access or delete my entire database. Please find all places in my code where database queries are built using string concatenation or template literals with user input, and replace them with parameterised queries or a query builder that handles this safely.\""

Example 3 (eval with user input):
"In Lovable (or Cursor), paste this exactly:\n\"I have a critical security vulnerability where my code uses eval() to run code from user input. This lets attackers execute any code they want on my server. Please find and remove all uses of eval() in my code and replace them with safe alternatives — JSON.parse() for JSON data, or ask me what the eval() is trying to do so we can find a safer way.\""

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
- File: ${f.path.replace(/^.*vibetrace-scan-[^\/]+\//, '')}:${f.start.line}
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
