-- ==========================================
-- Emergency Fix: RLS Policies for Rate Limiting
-- ==========================================

-- 1. Allow unauthenticated (anon) users to check and log rate limits during login
DROP POLICY IF EXISTS "Enable check for anyone" ON public.rate_limit_logs;
CREATE POLICY "Enable check for anyone" ON public.rate_limit_logs
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable insert for anyone" ON public.rate_limit_logs;
CREATE POLICY "Enable insert for anyone" ON public.rate_limit_logs
FOR INSERT WITH CHECK (true);

-- 2. Allow unauthenticated (anon) users to log login attempts
DROP POLICY IF EXISTS "Enable insert for anyone" ON public.login_attempts;
CREATE POLICY "Enable insert for anyone" ON public.login_attempts
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable select for anyone" ON public.login_attempts;
CREATE POLICY "Enable select for anyone" ON public.login_attempts
FOR SELECT USING (true);

-- 3. Ensure tables are RLS enabled (already done in previous migrations, but safe to repeat)
ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
