# PRD: VibeTrace URL Scan Header Fixes

**Sprint:** ralph-vt-headers
**Repo:** /home/ralph/vibetrace
**Branch:** feature/url-headers
**Goal:** Fix remaining 5 DAST findings to push URL scan from 84/100 → 92+/100

---

## Context
VibeTrace URL scan (vibetrace.app) scores 84/100. All 5 remaining findings are missing HTTP security headers detected by ZAP. The repo scan is already 100/100.

## Findings to Fix

### 1. HIGH — zap-10055: CSP Missing Directive Fallbacks
**Current CSP in next.config.ts** has `default-src`, `script-src`, `style-src`, `img-src`, `connect-src`, `font-src`.
**Missing directives:** `frame-ancestors 'self'`, `form-action 'self'`, `base-uri 'self'`, `object-src 'none'`, `upgrade-insecure-requests`
**Action:** Add missing directives to the existing CSP header in `next.config.ts`. Do NOT remove `'unsafe-inline'` from style-src (Next.js requires it).

### 2. MEDIUM — zap-90004: Cross-Origin-Embedder-Policy Missing
**Action:** Add header `Cross-Origin-Embedder-Policy: credentialless` (use `credentialless` not `require-corp` — `require-corp` breaks third-party resources like Google Fonts and Supabase).

### 3. MEDIUM — zap-10063: Permissions-Policy Not Set
**Action:** Add header:
```
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()
```

### 4. LOW — zap-10019: Content-Type Header Missing
**Action:** Check if any API routes or middleware responses are missing Content-Type. Add `Content-Type: application/json` to API responses if needed. This may already be handled by Next.js — verify.

### 5. LOW — zap-cache-combined: Cache-Control Inconsistent
**Action:** Add to API routes (especially /api/scan): `Cache-Control: no-store, no-cache, must-revalidate`
For static pages, Next.js handles caching — don't override those.

## File to Edit
Primary: `next.config.ts` (headers section)
Secondary: Check `src/app/api/scan/route.ts` for explicit response headers if needed.

## Constraints
- Do NOT break existing functionality
- Do NOT remove `unsafe-inline` from style-src
- Do NOT use `require-corp` for COEP (breaks external resources)
- All headers go in `next.config.ts` `headers()` config where possible
- Run `npm run build` to verify no build errors
- Commit to `feature/url-headers` branch

## Definition of Done
- All 5 headers added/fixed
- `npm run build` succeeds
- Merge to main
- `pm2 restart vibetrace`
- Verify headers present via `curl -I https://vibetrace.app`
