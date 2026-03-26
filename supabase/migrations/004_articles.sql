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
