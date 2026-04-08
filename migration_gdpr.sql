-- ==========================================
-- GDPR Compliance Layer
-- Run this in the Supabase SQL Editor
-- ==========================================
-- Prerequisites:
--   1. Create a private Storage bucket named "gdpr-exports" in your Supabase dashboard
--      (Dashboard → Storage → New bucket → name: gdpr-exports, Public: OFF)
-- ==========================================

-- 1. Soft-delete markers on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;

-- 2. GDPR requests table — tracks every export / deletion request with 30-day SLA
CREATE TABLE IF NOT EXISTS public.gdpr_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type         TEXT        NOT NULL CHECK (type IN ('export', 'delete')),
  status       TEXT        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  completed_at TIMESTAMPTZ,
  download_url TEXT,
  notes        TEXT
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_gdpr_user
  ON public.gdpr_requests (user_id, requested_at DESC);

-- Index used when polling for overdue requests
CREATE INDEX IF NOT EXISTS idx_gdpr_due
  ON public.gdpr_requests (due_at)
  WHERE status IN ('pending', 'processing');

-- RLS: users see only their own requests
ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gdpr_requests_own" ON public.gdpr_requests;
CREATE POLICY "gdpr_requests_own"
  ON public.gdpr_requests
  FOR ALL
  USING (user_id = auth.uid());

-- 3. anonymise_user — strips personal data, preserves relational structure
--    Called by the server action; runs as SECURITY DEFINER so it can
--    write to audit_logs and delete from auth.users.
CREATE OR REPLACE FUNCTION public.anonymise_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  anon_name TEXT := 'Deleted User ' || SUBSTR(p_user_id::TEXT, 1, 8);
BEGIN
  -- Mark the profile as deleted (keeps the row so FK constraints hold)
  UPDATE public.profiles SET
    name       = anon_name,
    is_deleted = TRUE,
    deleted_at = NOW()
  WHERE id = p_user_id;

  -- Scrub comment content but keep thread structure intact
  UPDATE public.comments SET
    content   = '[deleted]',
    author_id = NULL
  WHERE author_id = p_user_id;

  -- Scrub actor identity from audit trail; keep the action record
  UPDATE public.audit_logs SET
    actor_name = anon_name,
    ip_address = NULL
  WHERE actor_id = p_user_id;

  -- Delete digest preferences entirely (pure personal data, no relational value)
  DELETE FROM public.digest_preferences WHERE user_id = p_user_id;

  -- Hard-delete from auth.users last — invalidates all sessions immediately
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- Revoke direct execution from authenticated users (called server-side via service role only)
REVOKE EXECUTE ON FUNCTION public.anonymise_user(UUID) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.anonymise_user(UUID) TO service_role;
