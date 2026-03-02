-- Migration: Saved URLs feature
-- NOTE: This migration needs to be run manually in the Supabase SQL editor
-- as the Supabase CLI is not available on this VPS.

CREATE TABLE IF NOT EXISTS saved_urls (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label TEXT,
  scan_count INTEGER DEFAULT 1,
  last_scanned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, url)
);

-- RLS: users can only see their own saved URLs
ALTER TABLE saved_urls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saved_urls" ON saved_urls
  FOR ALL USING (auth.uid() = user_id);

-- Admin can see all
CREATE POLICY "Admin read all saved_urls" ON saved_urls
  FOR SELECT USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'gavin.ranton@gmail.com'
  );
