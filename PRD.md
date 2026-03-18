# PRD: VibeTrace Outbound Scan API
**Date:** 2026-03-17
**Author:** Aria
**Status:** DRAFT — awaiting Gavin approval
**Priority:** CRITICAL — enables full customer acquisition pipeline

## Problem
The outbound scanner currently:
- Runs Semgrep locally with generic rules (not VibeTrace's configured rules)
- Stores results in local JSON files (not the database)
- Can't provide full report links with fix prompts, business impact, verification steps
- Has no conversion tracking (email → signup path unknown)

## Solution
Create a new VibeTrace API endpoint `/api/scan/outbound` that:
- Accepts a GitHub repo URL + owner email from the outbound scanner
- Triggers VibeTrace's full scan pipeline (Semgrep SAST + Gemini translation + optional DAST/SEO)
- Stores results in the production database (same as user-initiated scans)
- Generates a shareable report link with all findings + fix prompts
- Returns the share token for emailing to the repo owner

## API Spec

### POST `/api/scan/outbound`

**Authentication:** API key in Authorization header (not Supabase auth)

**Headers:**
```
Authorization: Bearer <OUTBOUND_API_KEY>
Content-Type: application/json
```

**Request Body:**
```json
{
  "repo_full_name": "ankurrera/SoloLeveling",
  "github_token": "ghp_xxxx",  // (optional) GitHub OAuth token for private repos
  "owner_email": "ankurr.era@gmail.com",
  "scan_type": "repo"  // or "url" if deployed_url provided
}
```

**Response (201 Created):**
```json
{
  "scan_id": "uuid-here",
  "share_token": "uuid-token",
  "share_url": "https://vibetrace.app/report/uuid-token",
  "status": "started",
  "message": "Scan started. Results will be ready in 2-3 minutes."
}
```

**Response (400 Bad Request):**
```json
{
  "error": "invalid_repo",
  "message": "Repository not found or not accessible"
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "invalid_api_key",
  "message": "API key is invalid or expired"
}
```

**Response (429 Too Many Requests):**
```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many scans from this source. Limit: 100/day"
}
```

## Implementation Details

### 1. Database Changes
No schema changes needed. Reuse existing `scans` and `findings` tables.

Create a special "system" user in Supabase auth for outbound scans:
- Email: `outbound-scanner@vibetrace.app`
- Password: random
- Role: regular user (no special privileges)

All outbound scans will be owned by this user. This allows:
- Tracking outbound scans separately via `user_id`
- Using the existing share mechanism
- No RLS policy bypasses needed

### 2. New Code (VibeTrace)
**File:** `src/app/api/scan/outbound/route.ts`

```typescript
// POST /api/scan/outbound
// - Validate API key from Authorization header
// - Extract repo_full_name, github_token (optional), owner_email from body
// - Create a scan record owned by the outbound-scanner system user
// - Call the existing scanProcessing function (reuse from /api/scan/route.ts)
// - Return share_token + share_url
// - Rate limit: 100 scans/day per API key (in Redis or in-memory)
```

**Key design:**
- Don't duplicate scan logic — call the same `processScan()` function from `/api/scan/route.ts`
- Validate API key against an environment variable `VIBETRACE_OUTBOUND_API_KEY`
- Store owner_email in scan metadata (new column: `metadata.owner_email`) for later email tracking
- Log all outbound scans with `source: "outbound-scanner"` for audit trail

### 3. Outbound Scanner Changes
**File:** `scripts/vibetrace-outbound/scanner.py`

Replace local Semgrep scan with API call:
```python
def scan_repo_via_api(repo_full_name: str, owner_email: str, github_token: Optional[str]) -> dict:
    """Call VibeTrace API to scan a repo."""
    result = requests.post(
        "https://vibetrace.app/api/scan/outbound",
        headers={"Authorization": f"Bearer {VIBETRACE_OUTBOUND_API_KEY}"},
        json={
            "repo_full_name": repo_full_name,
            "owner_email": owner_email,
            "github_token": github_token,
            "scan_type": "repo",
        },
        timeout=30,
    )
    
    if result.status_code == 201:
        data = result.json()
        return {
            "scan_id": data["scan_id"],
            "share_url": data["share_url"],
            "status": "started",
        }
    elif result.status_code == 429:
        return {"error": "rate_limit"}
    else:
        return {"error": result.json().get("error", "unknown")}
```

### 4. Email Changes
Email template now links to the real report:
```
Your VibeTrace Report: https://vibetrace.app/report/{share_token}

This is the live report with:
- All findings (SAST + DAST + SEO)
- Plain-English explanations
- Fix prompts for your code generator (Lovable/Cursor/Bolt)
- Business impact for each issue
- Verification steps
```

## Security Considerations

1. **API Key**: Stored in environment variable, not hardcoded. Rotatable.
2. **Rate limiting**: 100 scans/day per key to prevent abuse.
3. **Share token security** (CRITICAL):
   - Each report has a unique UUID share_token (not guessable)
   - Share link only works if `is_shared: true` AND token matches
   - Email must NOT be forwarded — share URL only valid for original recipient
   - Implement share_token scope: each token can only be viewed from the email recipient's IP or after email verification
   - Alternative: add `recipient_email` to scan metadata, validate that email is in `To:` header when accessing report
4. **User ownership**: All scans owned by the outbound-scanner system user, so:
   - Outbound scans are isolated from real user scans
   - No access to other users' scans
5. **Email validation**: Owner email is stored in metadata for later verification if the user signs up.
6. **Audit trail**: All outbound scans logged with `source: "outbound-scanner"` for compliance.

## Success Criteria

- ✅ API accepts GitHub repo URLs and returns share tokens
- ✅ Share URL displays full VibeTrace report (same as user-created scans)
- ✅ Findings include plain_english, fix_prompt, business_impact, verification_step
- ✅ Email contains link to report with all findings visible
- ✅ Rate limiting prevents abuse (100/day limit enforced)
- ✅ Outbound scans tracked separately (source="outbound-scanner") for analytics
- ✅ Shared report doesn't require login to view

## Implementation Order

1. Create the outbound-scanner system user in Supabase
2. Write the `/api/scan/outbound` endpoint (Ralph sprint)
3. Test on staging with real repo scan
4. Update the Python scanner to call the API
5. Send test email with real report link
6. Launch full outbound campaign

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| API key leaked | Rotate key, use short TTL, monitor rate limit hits |
| Abuse (spam scanning) | Rate limit (100/day), IP-based limit as fallback |
| Database bloat | Cleanup job for abandoned outbound scans (>30 days old) |
| Email bounce rate | Monitor Resend bounce metrics, remove invalid emails |
| Users confused by unsolicited emails | Clear messaging: "We scanned your public GitHub repo" |

## Acceptance Criteria (Ralph to verify)

- [ ] POST request to `/api/scan/outbound` with valid API key creates a scan
- [ ] API key from header is validated (reject if missing/invalid)
- [ ] Response includes `scan_id`, `share_token`, `share_url`, `status`
- [ ] Rate limit enforced (5th request in 1 minute returns 429)
- [ ] Share URL loads full report without login
- [ ] Findings display plain_english, fix_prompt, business_impact
- [ ] Scan shows `source: "outbound-scanner"` in database metadata
- [ ] Owner email stored in metadata for attribution
