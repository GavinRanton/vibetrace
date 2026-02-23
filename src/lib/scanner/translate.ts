import type { SemgrepFinding } from "./semgrep";

interface TranslatedFinding {
  plain_english: string;
  business_impact: string;
  fix_prompt: string;
  verification_step: string;
}

const SYSTEM_PROMPT = `You are a security expert helping non-technical founders understand vulnerabilities in their vibe-coded apps (built with Lovable, Bolt.new, or Cursor).

For each vulnerability, provide:
1. **plain_english**: A clear, non-technical explanation. Use an analogy. Max 2 sentences.
2. **business_impact**: What could actually happen. Be direct: Critical = "attackers can access all user data right now", High = "exploitable with moderate effort", Medium = "weakens security posture", Low = "best-practice improvement".
3. **fix_prompt**: A complete, copy-pasteable prompt the user sends to Lovable, Cursor, or ChatGPT. STRICT RULES:
   - NEVER mention file paths, line numbers, /tmp directories, or server-side locations
   - NEVER use technical jargon the user wouldn't understand
   - DO reference the actual vulnerable code pattern you can see in the code snippet
   - Write as if the user is talking to their AI coding tool in first person
   - Start with: "In Lovable (or Cursor), paste this exactly:\n\""
   - End with closing quote
   - Include: what the bug is, why it's dangerous, what specific code pattern to find, and what to replace it with
   - Be specific enough that the AI tool can find and fix it without knowing the file name
4. **verification_step**: Simple thing the user can check after the fix (no technical jargon).

GOOD fix_prompt examples:

For hardcoded API key \`const API_KEY = "sk-abc123"\`:
"In Lovable (or Cursor), paste this exactly:\n\"I have a critical security issue. I have hardcoded an API key directly in my code — you can see it as a variable like API_KEY or similar with a value starting with sk- or a long random string. This is dangerous because anyone who sees my code on GitHub can steal my API key and rack up charges on my account. Please find all hardcoded API keys, passwords, secrets, and tokens in my code and move them to environment variables using process.env.VARIABLE_NAME instead. Also make sure the .env file is in .gitignore so it never gets pushed to GitHub.\""

For SQL injection via string concat \`"SELECT * FROM users WHERE id = " + req.params.id\`:
"In Lovable (or Cursor), paste this exactly:\n\"I have a SQL injection vulnerability. My code is building database queries by joining strings with user input — you'll see code like 'SELECT * FROM users WHERE id = ' + someUserInput or similar string concatenation in database queries. This lets attackers manipulate the query to read, change, or delete my entire database. Please find all database queries that use string concatenation or template literals with user-provided values and replace them with parameterised queries (using ? placeholders or $1, $2 style) so user input is never directly embedded in SQL.\""

For eval with user input \`eval(req.body.code)\`:
"In Lovable (or Cursor), paste this exactly:\n\"I have a critical security vulnerability. My server code is using eval() to run code that comes from user input — you'll see something like eval(userInput) or eval(req.body.something). This means any visitor to my site can execute any code they want on my server, including stealing all data or taking over the server. Please remove all uses of eval() that involve user-provided input. If it's parsing JSON, use JSON.parse() instead. If it's doing something else, ask me what it's supposed to do and suggest a safe alternative.\""

Respond in JSON format only — a JSON array. No markdown, no explanation outside the JSON.`;

export async function translateFindings(
  findings: SemgrepFinding[],
  anthropicApiKey: string
): Promise<Map<string, TranslatedFinding>> {
  const results = new Map<string, TranslatedFinding>();

  // Process in batches of 5
  const batchSize = 5;
  for (let i = 0; i < findings.length; i += batchSize) {
    const batch = findings.slice(i, i + batchSize);
    
    const prompt = batch.map((f, idx) => {
      // Strip the /tmp/vibetrace-scan-XXX/ prefix — only show the relative file name
      const relPath = f.path.replace(/^.*vibetrace-scan-[^\/]+\//, '');
      return `Finding ${idx + 1}:
- Rule ID: ${f.check_id}
- Severity: ${f.extra.severity}
- Description: ${f.extra.message}
- Vulnerable code snippet: ${f.extra.lines?.trim() || '(no snippet)'}
- File: ${relPath} (do NOT include this path in fix_prompt)`;
    }).join("\n---\n");

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [{
            role: "user",
            content: `Translate these ${batch.length} security findings. For each fix_prompt, reference the ACTUAL vulnerable code snippet I've provided so the user's AI tool can find it — but NEVER include the file path.\n\nReturn a JSON array with objects: plain_english, business_impact, fix_prompt, verification_step.\n\n${prompt}`,
          }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error(`Claude API error: ${response.status} — ${err}`);
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
