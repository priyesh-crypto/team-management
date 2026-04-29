-- ==============================================================================
-- BILLING LOGIC FIXES
-- - Fix is_platform_admin RLS recursion via SECURITY DEFINER
-- - Recompute MRR using regional plan_prices (not just base plan price)
-- - Helper: count active members (used for seat-down validation)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1. Fix recursive policy on platform_admins (use SECURITY DEFINER fn)
-- ------------------------------------------------------------------
DROP POLICY IF EXISTS "Platform admins can view admin list" ON public.platform_admins;
CREATE POLICY "Platform admins can view admin list" ON public.platform_admins
    FOR SELECT USING (public.is_platform_admin());

-- ------------------------------------------------------------------
-- 2. Replace platform_revenue_summary to use REGIONAL prices
-- ------------------------------------------------------------------
DROP VIEW IF EXISTS public.platform_revenue_summary;

CREATE OR REPLACE VIEW public.platform_revenue_summary AS
SELECT
    o.plan_id,
    p.name AS plan_name,
    COUNT(*) AS org_count,
    COUNT(*) FILTER (WHERE o.subscription_status = 'active') AS active_count,
    COUNT(*) FILTER (WHERE o.subscription_status = 'trialing') AS trialing_count,
    COUNT(*) FILTER (WHERE o.subscription_status = 'past_due') AS past_due_count,
    SUM(o.seats_purchased) FILTER (WHERE o.subscription_status IN ('active', 'trialing')) AS active_seats,
    SUM(
        o.seats_purchased * COALESCE(
            (SELECT pp.price_monthly_cents
             FROM public.plan_prices pp
             WHERE pp.plan_id = o.plan_id
               AND pp.country_code = COALESCE(o.billing_country, 'DEFAULT')
               AND pp.is_active
             LIMIT 1),
            (SELECT pp.price_monthly_cents
             FROM public.plan_prices pp
             WHERE pp.plan_id = o.plan_id
               AND pp.country_code = 'DEFAULT'
               AND pp.is_active
             LIMIT 1),
            p.price_monthly_cents
        )
    ) FILTER (WHERE o.subscription_status = 'active') AS mrr_cents
FROM public.organizations o
JOIN public.plans p ON p.id = o.plan_id
GROUP BY o.plan_id, p.name;

GRANT SELECT ON public.platform_revenue_summary TO authenticated;

-- ------------------------------------------------------------------
-- 3. Active member counter (used to prevent seat-down below active usage)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_active_member_count(target_org UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COUNT(*)::INT FROM public.organization_members WHERE org_id = target_org;
$$;

GRANT EXECUTE ON FUNCTION public.org_active_member_count(UUID) TO authenticated;

COMMIT;
