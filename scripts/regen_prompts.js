// Re-generate fix_prompts for existing findings with broken /tmp paths
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
require('dotenv').config({ path: '.env.local' });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are a security expert helping non-technical founders understand vulnerabilities in their vibe-coded apps (built with Lovable, Bolt.new, or Cursor).

For each vulnerability, provide:
1. **plain_english**: Clear, non-technical explanation with an analogy. Max 2 sentences.
2. **fix_prompt**: A complete, copy-pasteable prompt the user sends to Lovable, Cursor, or ChatGPT. STRICT RULES:
   - NEVER mention file paths, line numbers, /tmp directories, or server-side locations
   - NEVER use technical jargon the user wouldn't understand
   - DO reference the actual vulnerable code pattern from the code snippet
   - Write as if the user is talking to their AI coding tool in first person
   - Start with: "In Lovable (or Cursor), paste this exactly:\\n\\""
   - End with closing quote
   - Include: what the bug is, why it's dangerous, what specific code pattern to find, and what to replace it with
   - Be specific enough that the AI tool can find and fix it without knowing the file name
3. **verification_step**: Simple thing the user can check after the fix (no jargon).

Respond in JSON format only — a JSON array. No markdown.`;

function claudeRequest(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }]
    });
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(data));
        else reject(new Error(`Claude ${res.statusCode}: ${data.substring(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Find all findings with garbage fix_prompts (containing /tmp/ or just a short fallback)
  const { data: findings, error } = await db
    .from('findings')
    .select('id, severity, category, rule_id, file_path, line_number, code_snippet, plain_english, raw_output')
    .or('fix_prompt.ilike.%/tmp/%,fix_prompt.ilike.Fix the issue%');

  if (error) { console.error('Fetch error:', error); process.exit(1); }
  console.log(`Found ${findings.length} findings to re-generate`);

  // Process in batches of 5
  const batchSize = 5;
  let fixed = 0;
  
  for (let i = 0; i < findings.length; i += batchSize) {
    const batch = findings.slice(i, i + batchSize);
    
    const prompt = batch.map((f, idx) => {
      // Strip /tmp paths
      const relPath = (f.file_path || '').replace(/^.*vibetrace-scan-[^\/]+\//, '');
      // Get description from raw_output if available
      const rawMsg = f.raw_output?.extra?.message || '';
      const codeSnippet = f.code_snippet || f.raw_output?.extra?.lines || '(no snippet available)';
      const description = rawMsg || f.plain_english || `${f.category} vulnerability`;
      
      return `Finding ${idx + 1}:
- Rule ID: ${f.rule_id || f.category}
- Severity: ${f.severity}
- Description: ${description}
- Vulnerable code snippet: ${typeof codeSnippet === 'string' ? codeSnippet.trim() : JSON.stringify(codeSnippet)}
- File hint: ${relPath || 'server-side code'} (do NOT include this in fix_prompt)`;
    }).join('\n---\n');

    try {
      console.log(`Processing batch ${Math.floor(i/batchSize)+1}/${Math.ceil(findings.length/batchSize)}...`);
      const resp = await claudeRequest(
        `Re-generate fix prompts for these ${batch.length} findings. Reference the ACTUAL code snippet in the fix_prompt but NEVER include file paths.\n\nReturn JSON array with: plain_english, fix_prompt, verification_step.\n\n${prompt}`
      );
      const content = resp.content[0]?.text || '[]';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) { console.error('No JSON in response'); continue; }
      
      const translations = JSON.parse(jsonMatch[0]);
      
      for (let j = 0; j < batch.length; j++) {
        const t = translations[j];
        if (!t) continue;
        const { error: updateError } = await db
          .from('findings')
          .update({
            plain_english: t.plain_english || batch[j].plain_english,
            fix_prompt: t.fix_prompt,
            verification_step: t.verification_step,
          })
          .eq('id', batch[j].id);
        
        if (updateError) console.error(`Update error for ${batch[j].id}:`, updateError);
        else { fixed++; console.log(`  ✓ Fixed: ${batch[j].category} (${batch[j].severity})`); }
      }
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error(`Batch error:`, err.message);
    }
  }
  
  console.log(`\nDone. Fixed ${fixed}/${findings.length} findings.`);
}

main().catch(console.error);
