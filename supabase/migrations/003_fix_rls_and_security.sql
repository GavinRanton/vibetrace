-- ============================================================
-- 003_fix_rls_and_security.sql
-- Fix RLS init plan performance + duplicate policies + function search paths
-- Policies confirmed from Supabase dashboard 2026-02-28
-- ============================================================

-- --------------------------------------------------------
-- SECTION 1: Fix RLS init plan on public.users
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING ((select auth.uid()) = id);

-- --------------------------------------------------------
-- SECTION 2: Fix RLS init plan on public.repos
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own repos" ON public.repos;
CREATE POLICY "Users can view own repos" ON public.repos
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own repos" ON public.repos;
CREATE POLICY "Users can insert own repos" ON public.repos
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own repos" ON public.repos;
CREATE POLICY "Users can delete own repos" ON public.repos
  FOR DELETE USING ((select auth.uid()) = user_id);

-- --------------------------------------------------------
-- SECTION 3: Fix RLS init plan on public.scans + drop duplicate
-- "Users can read own scans" and "Users can view own scans" are duplicates
-- Keeping "Users can view own scans", dropping "Users can read own scans"
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own scans" ON public.scans;
DROP POLICY IF EXISTS "Users can read own scans" ON public.scans;
CREATE POLICY "Users can view own scans" ON public.scans
  FOR SELECT USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own scans" ON public.scans;
CREATE POLICY "Users can insert own scans" ON public.scans
  FOR INSERT WITH CHECK ((select auth.uid()) = user_id);

-- --------------------------------------------------------
-- SECTION 4: Fix RLS init plan on public.findings + drop duplicate
-- "Users can read own findings" and "Users can view own findings" are duplicates
-- Keeping "Users can view own findings", dropping "Users can read own findings"
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own findings" ON public.findings;
DROP POLICY IF EXISTS "Users can read own findings" ON public.findings;
CREATE POLICY "Users can view own findings" ON public.findings
  FOR SELECT USING (
    (select auth.uid()) = (SELECT user_id FROM public.scans WHERE id = scan_id)
  );

DROP POLICY IF EXISTS "Users can update own findings" ON public.findings;
CREATE POLICY "Users can update own findings" ON public.findings
  FOR UPDATE USING (
    (select auth.uid()) = (SELECT user_id FROM public.scans WHERE id = scan_id)
  );

-- --------------------------------------------------------
-- SECTION 5: Fix RLS init plan on public.badges
-- "Users can manage own badges" is ALL — fix the auth.uid() call
-- "Public can verify badges" is intentionally public SELECT — leave it
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own badges" ON public.badges;
CREATE POLICY "Users can manage own badges" ON public.badges
  FOR ALL USING ((select auth.uid()) = user_id);

-- --------------------------------------------------------
-- SECTION 6: Fix RLS init plan on public.subscriptions
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING ((select auth.uid()) = user_id);

-- --------------------------------------------------------
-- SECTION 7: Fix RLS init plan on public.deep_audits
-- --------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own deep audits" ON public.deep_audits;
CREATE POLICY "Users can view own deep audits" ON public.deep_audits
  FOR SELECT USING ((select auth.uid()) = user_id);

-- --------------------------------------------------------
-- SECTION 8: Fix mutable search_path on functions (security)
-- --------------------------------------------------------
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

-- --------------------------------------------------------
-- SECTION 9: Add composite index for findings query pattern
-- (findings queried by scan_id ordered by severity — seen in slow query log)
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_findings_scan_id_severity 
  ON public.findings(scan_id, severity);
