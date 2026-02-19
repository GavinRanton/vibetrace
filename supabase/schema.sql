-- VibeTrace Database Schema
-- Run this in Supabase SQL Editor after creating the project

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- USERS
-- =============================================
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    github_id TEXT UNIQUE,
    github_username TEXT,
    github_access_token TEXT, -- encrypted, for repo access
    stripe_customer_id TEXT UNIQUE,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro')),
    scan_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- REPOS
-- =============================================
CREATE TABLE public.repos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    github_repo_id TEXT NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL, -- e.g. "user/repo"
    default_branch TEXT DEFAULT 'main',
    is_private BOOLEAN DEFAULT false,
    last_scanned_at TIMESTAMPTZ,
    webhook_id TEXT, -- GitHub webhook ID for continuous monitoring
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, github_repo_id)
);

-- =============================================
-- SCANS
-- =============================================
CREATE TABLE public.scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repo_id UUID NOT NULL REFERENCES public.repos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'cloning', 'scanning', 'translating', 'complete', 'failed')),
    scan_type TEXT NOT NULL DEFAULT 'standard' CHECK (scan_type IN ('standard', 'deep_audit')),
    score INTEGER CHECK (score >= 0 AND score <= 100),
    total_findings INTEGER DEFAULT 0,
    critical_count INTEGER DEFAULT 0,
    high_count INTEGER DEFAULT 0,
    medium_count INTEGER DEFAULT 0,
    low_count INTEGER DEFAULT 0,
    semgrep_version TEXT,
    zap_included BOOLEAN DEFAULT false,
    duration_seconds INTEGER,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- FINDINGS
-- =============================================
CREATE TABLE public.findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
    severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    category TEXT NOT NULL, -- e.g. 'hardcoded-secrets', 'missing-auth', 'sql-injection'
    rule_id TEXT, -- Semgrep rule ID
    file_path TEXT NOT NULL,
    line_number INTEGER,
    code_snippet TEXT,
    raw_output JSONB, -- Raw Semgrep output
    plain_english TEXT, -- Claude translation
    business_impact TEXT, -- Claude severity explanation
    fix_prompt TEXT, -- Copy-paste prompt for Lovable/Cursor
    verification_step TEXT, -- What to check after fix
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'fixed', 'dismissed', 'false_positive')),
    fixed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- BADGES
-- =============================================
CREATE TABLE public.badges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    repo_id UUID NOT NULL REFERENCES public.repos(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    last_score INTEGER,
    last_verified_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    public_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, repo_id)
);

-- =============================================
-- STRIPE SUBSCRIPTIONS (for tracking)
-- =============================================
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    stripe_subscription_id TEXT UNIQUE,
    stripe_price_id TEXT,
    plan TEXT NOT NULL CHECK (plan IN ('starter', 'pro')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- DEEP AUDIT PURCHASES (one-time)
-- =============================================
CREATE TABLE public.deep_audits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    repo_id UUID NOT NULL REFERENCES public.repos(id) ON DELETE CASCADE,
    stripe_payment_intent_id TEXT UNIQUE,
    scan_id UUID REFERENCES public.scans(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'scanning', 'complete')),
    pdf_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- ROW LEVEL SECURITY (CRITICAL)
-- =============================================

-- Enable RLS on ALL tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deep_audits ENABLE ROW LEVEL SECURITY;

-- Users: can only read/update own record
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Repos: can only access own repos
CREATE POLICY "Users can view own repos" ON public.repos
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own repos" ON public.repos
    FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own repos" ON public.repos
    FOR DELETE USING (user_id = auth.uid());

-- Scans: can only access own scans
CREATE POLICY "Users can view own scans" ON public.scans
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own scans" ON public.scans
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Findings: access through scan ownership
CREATE POLICY "Users can view own findings" ON public.findings
    FOR SELECT USING (
        scan_id IN (SELECT id FROM public.scans WHERE user_id = auth.uid())
    );
CREATE POLICY "Users can update own findings" ON public.findings
    FOR UPDATE USING (
        scan_id IN (SELECT id FROM public.scans WHERE user_id = auth.uid())
    );

-- Badges: own badges + public read for verification
CREATE POLICY "Users can manage own badges" ON public.badges
    FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Public can verify badges" ON public.badges
    FOR SELECT USING (is_active = true);

-- Subscriptions: own only
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
    FOR SELECT USING (user_id = auth.uid());

-- Deep Audits: own only
CREATE POLICY "Users can view own deep audits" ON public.deep_audits
    FOR SELECT USING (user_id = auth.uid());

-- =============================================
-- SERVICE ROLE POLICIES (for API routes)
-- =============================================
-- The service role key bypasses RLS, which is what our
-- API routes use for scan processing, webhook handling, etc.

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_repos_user_id ON public.repos(user_id);
CREATE INDEX idx_scans_repo_id ON public.scans(repo_id);
CREATE INDEX idx_scans_user_id ON public.scans(user_id);
CREATE INDEX idx_scans_status ON public.scans(status);
CREATE INDEX idx_findings_scan_id ON public.findings(scan_id);
CREATE INDEX idx_findings_severity ON public.findings(severity);
CREATE INDEX idx_findings_status ON public.findings(status);
CREATE INDEX idx_badges_token ON public.badges(token);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
