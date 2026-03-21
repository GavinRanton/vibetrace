# Security Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the VibeTrace codebase by removing hardcoded secrets, adding security headers, fixing the semgrep path, splitting the 761-line scan route, and adding email validation + score threshold to the outbound scanner.

**Architecture:** Six self-contained stories, each committed independently. Stories 1–3 are small edits. Story 4 is a refactor that extracts ZAP logic, pipeline orchestration, and score calculation into focused modules. Stories 5–6 create a new outbound-scanner service with guard logic.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase, Resend, Semgrep, OWASP ZAP

---

## Story 1 — Vault token already removed

**Files:** `src/app/api/scan/route.ts` (no-op — token already gone)

- [ ] Verify `grep -r "f4e28f48" src/` returns 0 results
- [ ] Commit: `fix: story 1 — vault token confirmed removed (no hardcoded token found)`

---

## Story 2 — Add X-XSS-Protection header

**Files:** Modify `next.config.ts`

- [ ] Add `{ key: "X-XSS-Protection", value: "1; mode=block" }` to `securityHeaders`
- [ ] Commit: `feat: story 2 — add X-XSS-Protection security header`

---

## Story 3 — Fix hardcoded Semgrep path

**Files:** Modify `src/lib/scanner/semgrep.ts`

- [ ] Replace `/home/ralph/.local/bin/semgrep` with `${process.env.SEMGREP_PATH || 'semgrep'}`
- [ ] Replace `semgrepPath = '/home/ralph/.local/bin'` with `process.env.SEMGREP_PATH ? path.dirname(process.env.SEMGREP_PATH) : ''`
- [ ] Commit: `fix: story 3 — replace hardcoded semgrep path with env var`

---

## Story 4 — Split scan route.ts

**Files:**
- Create: `src/lib/supabase-admin.ts`
- Create: `src/lib/scanner/score.ts`
- Create: `src/lib/scanner/zap.ts`
- Create: `src/lib/scanner/pipeline.ts`
- Modify: `src/lib/scanner/translate.ts` (remove calculateScore)
- Modify: `src/app/api/scan/route.ts` (keep auth/validation/kickoff only, < 150 lines)

**Plan:**
- `supabase-admin.ts` — shared adminClient
- `score.ts` — calculateScore (moved from translate.ts)
- `zap.ts` — isPrivateUrl, all ZAP constants/helpers, runZapScan
- `pipeline.ts` — NON_PRODUCTION_PATH_PATTERNS, buildSemgrepSnippet helpers, processScan

---

## Story 5 — Email validation for outbound scanner

**Files:** Create `src/lib/outbound-scanner.ts`

- Block domains: example.com, example.org, test.com, localhost, mailinator.com
- Block .local TLD
- Block no-TLD addresses (no dot after @)
- Log blocked addresses

---

## Story 6 — Score threshold for outbound

**Files:** Modify `src/lib/outbound-scanner.ts`

- Only send emails when score < 80
- Log skipped repos with reason
