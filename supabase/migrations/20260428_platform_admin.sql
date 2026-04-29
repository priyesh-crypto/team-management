-- ==============================================================================
-- PLATFORM ADMIN MIGRATION
-- Purpose: Adds super-admin role for SaaS operators (you) to manage all orgs.
-- Distinct from org_role — these users transcend org boundaries.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1. Platform admins table
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id),
    notes TEXT
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Only platform admins can see the list (chicken-and-egg: bootstrap manually via service role)
DROP POLICY IF EXISTS "Platform admins can view admin list" ON public.platform_admins;
CREATE POLICY "Platform admins can view admin list" ON public.platform_admins
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
    );

-- ------------------------------------------------------------------
-- 2. Helper function: is_platform_admin()
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- ------------------------------------------------------------------
-- 3. Platform-admin override RLS — read-all access on key tables
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "Platform admins can view all organizations" ON public.organizations;
CREATE POLICY "Platform admins can view all organizations" ON public.organizations
    FOR SELECT USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can update all organizations" ON public.organizations;
CREATE POLICY "Platform admins can update all organizations" ON public.organizations
    FOR UPDATE USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can view all members" ON public.organization_members;
CREATE POLICY "Platform admins can view all members" ON public.organization_members
    FOR SELECT USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can view all usage" ON public.org_usage;
CREATE POLICY "Platform admins can view all usage" ON public.org_usage
    FOR SELECT USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Platform admins can write plans" ON public.plans;
CREATE POLICY "Platform admins can write plans" ON public.plans
    FOR ALL USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- ------------------------------------------------------------------
-- 4. Audit log for platform admin actions
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admin_actions (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL,                 -- e.g. 'set_plan', 'extend_trial', 'comp_subscription'
    target_org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_admin_actions_org ON public.platform_admin_actions(target_org_id);
CREATE INDEX IF NOT EXISTS idx_platform_admin_actions_admin ON public.platform_admin_actions(admin_user_id);

ALTER TABLE public.platform_admin_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admins can view audit log" ON public.platform_admin_actions;
CREATE POLICY "Platform admins can view audit log" ON public.platform_admin_actions
    FOR SELECT USING (public.is_platform_admin());

-- ------------------------------------------------------------------
-- 5. Revenue summary view
-- ------------------------------------------------------------------
CREATE OR REPLACE VIEW public.platform_revenue_summary AS
SELECT
    o.plan_id,
    p.name AS plan_name,
    COUNT(*) AS org_count,
    COUNT(*) FILTER (WHERE o.subscription_status = 'active') AS active_count,
    COUNT(*) FILTER (WHERE o.subscription_status = 'trialing') AS trialing_count,
    COUNT(*) FILTER (WHERE o.subscription_status = 'past_due') AS past_due_count,
    SUM(o.seats_purchased) FILTER (WHERE o.subscription_status IN ('active', 'trialing')) AS active_seats,
    SUM(o.seats_purchased * p.price_monthly_cents) FILTER (WHERE o.subscription_status = 'active') AS mrr_cents
FROM public.organizations o
JOIN public.plans p ON p.id = o.plan_id
GROUP BY o.plan_id, p.name;

GRANT SELECT ON public.platform_revenue_summary TO authenticated;

COMMIT;

-- ==============================================================================
-- BOOTSTRAP: After running this, manually grant yourself admin via SQL Editor:
--   INSERT INTO public.platform_admins (user_id) VALUES ('<your-auth-uid>');
-- ==============================================================================
