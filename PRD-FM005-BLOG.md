# PRD: FM-005 — Blog/Article System for VibeTrace

## Summary
Add a blog system to VibeTrace for SEO content about code security, vulnerability scanning, and DevSecOps. Uses Supabase (raw SQL + supabase-js client).

## Tech Stack
- **DB:** Supabase (PostgreSQL)
- **Client:** @supabase/supabase-js + @supabase/ssr
- **Framework:** Next.js with Tailwind
- **Theme:** Dark (#0A0A0F background, white text, blue accent #3B82F6)

## Schema (Supabase migration — create supabase/migrations/004_articles.sql)

```sql
CREATE TABLE public.articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    content TEXT NOT NULL,
    cover_image TEXT,
    category TEXT NOT NULL CHECK (category IN ('security-guides', 'vulnerability-types', 'devsecops', 'product-updates')),
    tags TEXT[] DEFAULT '{}',
    published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    author_name TEXT DEFAULT 'VibeTrace Team',
    seo_title TEXT,
    seo_description TEXT,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_articles_slug ON public.articles(slug);
CREATE INDEX idx_articles_published ON public.articles(published, published_at DESC);
CREATE INDEX idx_articles_category ON public.articles(category);

-- RLS: articles are publicly readable
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Articles are publicly readable" ON public.articles FOR SELECT USING (published = true);
CREATE POLICY "Admins can manage articles" ON public.articles FOR ALL USING (auth.role() = 'service_role');
```

## Pages to Create

### 1. `/blog` — Article listing (src/app/blog/page.tsx)
- Server component
- Category filter: All, Security Guides, Vulnerability Types, DevSecOps, Product Updates
- Dark theme card grid matching VibeTrace's existing dark UI
- Use the same nav/footer pattern as /pricing page
- SEO: title "Blog | VibeTrace", canonical, OG tags

### 2. `/blog/[slug]` — Article detail (src/app/blog/[slug]/page.tsx)
- Server component with dynamic metadata
- Render markdown content (install `react-markdown` + `remark-gfm`)
- Dark theme prose styling (use `prose-invert` from Tailwind typography)
- Back link to /blog
- SEO: dynamic title/description, canonical, OG, article schema

### 3. API route `/api/articles` (src/app/api/articles/route.ts)
- GET: list published articles from Supabase
- Optional `?category=` filter

### 4. Supabase client usage
- Use existing Supabase client pattern from the codebase
- Check src/lib/supabase/ for server/client helpers

### 5. Update sitemap and robots.txt
- Add blog article URLs

## Styling
- Background: #0A0A0F (matches existing)
- Cards: border-white/5, bg-white/[0.02] (matches pricing cards)
- Accent: #3B82F6 (blue, matches existing)
- Text: white/70 for body, white for headings

## DO NOT
- Add admin UI
- Touch auth, scan, dashboard, or account pages
- Change existing Supabase schema or RLS policies
- Use Prisma or Drizzle (this project uses raw Supabase)

## Acceptance Criteria
- [ ] Migration runs without error
- [ ] `/blog` returns 200 with dark theme
- [ ] `/blog/[slug]` returns 200 for a test article
- [ ] Markdown renders correctly with dark prose
- [ ] Sitemap includes blog URLs
- [ ] `npm run build` succeeds
