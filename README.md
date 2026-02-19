# VibeTrace

**Scan your vibe-coded app. Find the vulnerabilities. Fix them in one click.**

AI-powered security scanner for non-technical founders who built their app using Lovable, Bolt.new, or Cursor.

## Stack

- **Frontend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Auth:** Supabase Auth + GitHub OAuth
- **Database:** Supabase PostgreSQL
- **Scanner:** Semgrep CLI (containerised)
- **AI:** Anthropic Claude (translation + fix prompts)
- **Payments:** Stripe
- **Email:** Resend
- **Hosting:** VPS (scanner workers) + Vercel/VPS (frontend)

## Getting Started

```bash
npm install
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values. Never commit secrets.

---

© Reverbia AI Ltd
