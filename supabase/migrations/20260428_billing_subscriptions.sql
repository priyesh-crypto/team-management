-- ==============================================================================
-- BILLING & SUBSCRIPTIONS MIGRATION
-- Purpose: Adds Stripe-backed subscription model to organizations.
-- Instructions: Run once in the Supabase SQL Editor. Safe to re-run (idempotent).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------
-- 1. Plans catalog (seeded with Free / Pro / Business)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    stripe_price_id TEXT,
    price_monthly_cents INT NOT NULL DEFAULT 0,
    seat_limit INT,                     -- NULL = unlimited
    project_limit INT,                  -- NULL = unlimited
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.plans (id, name, price_monthly_cents, seat_limit, project_limit, features, sort_order)
VALUES
    ('free', 'Free', 0, 3, 1,
        '{"workload_heatmap": false, "digest_emails": false, "sso": false, "audit_logs": false, "priority_support": false}'::jsonb, 1),
    ('pro', 'Pro', 1200, NULL, NULL,
        '{"workload_heatmap": true, "digest_emails": true, "sso": false, "audit_logs": false, "priority_support": false}'::jsonb, 2),
    ('business', 'Business', 2400, NULL, NULL,
        '{"workload_heatmap": true, "digest_emails": true, "sso": true, "audit_logs": true, "priority_support": true}'::jsonb, 3)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    price_monthly_cents = EXCLUDED.price_monthly_cents,
    seat_limit = EXCLUDED.seat_limit,
    project_limit = EXCLUDED.project_limit,
    features = EXCLUDED.features,
    sort_order = EXCLUDED.sort_order;

-- Plans are world-readable (pricing page); only service role writes.
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Plans are readable by everyone" ON public.plans;
CREATE POLICY "Plans are readable by everyone" ON public.plans
    FOR SELECT USING (TRUE);

-- ------------------------------------------------------------------
-- 2. Subscription status enum
-- ------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
        CREATE TYPE subscription_status AS ENUM (
            'trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid'
        );
    END IF;
END $$;

-- ------------------------------------------------------------------
-- 3. Extend organizations with subscription state
-- ------------------------------------------------------------------
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS plan_id TEXT REFERENCES public.plans(id) DEFAULT 'free',
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS subscription_status subscription_status,
    ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS seats_purchased INT NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill any orgs missing a plan
UPDATE public.organizations SET plan_id = 'free' WHERE plan_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer ON public.organizations(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_subscription ON public.organizations(stripe_subscription_id);

-- ------------------------------------------------------------------
-- 4. Usage snapshot (cheap reads for entitlement checks)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_usage (
    org_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    active_seats INT NOT NULL DEFAULT 0,
    project_count INT NOT NULL DEFAULT 0,
    task_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.org_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can read their org usage" ON public.org_usage;
CREATE POLICY "Members can read their org usage" ON public.org_usage
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.organization_members
            WHERE org_id = org_usage.org_id AND user_id = auth.uid()
        )
    );

-- Maintain usage counts via triggers
CREATE OR REPLACE FUNCTION public.recompute_org_usage(target_org UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.org_usage (org_id, active_seats, project_count, task_count, updated_at)
    SELECT
        target_org,
        (SELECT COUNT(*) FROM public.organization_members WHERE org_id = target_org),
        COALESCE((SELECT COUNT(*) FROM public.workspaces WHERE org_id = target_org), 0),
        COALESCE((SELECT COUNT(*) FROM public.tasks WHERE org_id = target_org), 0),
        NOW()
    ON CONFLICT (org_id) DO UPDATE SET
        active_seats = EXCLUDED.active_seats,
        project_count = EXCLUDED.project_count,
        task_count = EXCLUDED.task_count,
        updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_recompute_org_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_org UUID;
BEGIN
    target_org := COALESCE(NEW.org_id, OLD.org_id);
    IF target_org IS NOT NULL THEN
        PERFORM public.recompute_org_usage(target_org);
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_org_usage_members ON public.organization_members;
CREATE TRIGGER trg_org_usage_members
    AFTER INSERT OR DELETE ON public.organization_members
    FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_org_usage();

DROP TRIGGER IF EXISTS trg_org_usage_workspaces ON public.workspaces;
CREATE TRIGGER trg_org_usage_workspaces
    AFTER INSERT OR DELETE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_org_usage();

DROP TRIGGER IF EXISTS trg_org_usage_tasks ON public.tasks;
CREATE TRIGGER trg_org_usage_tasks
    AFTER INSERT OR DELETE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.tg_recompute_org_usage();

-- One-time backfill for existing orgs
INSERT INTO public.org_usage (org_id, active_seats, project_count, task_count)
SELECT
    o.id,
    (SELECT COUNT(*) FROM public.organization_members m WHERE m.org_id = o.id),
    COALESCE((SELECT COUNT(*) FROM public.workspaces w WHERE w.org_id = o.id), 0),
    COALESCE((SELECT COUNT(*) FROM public.tasks t WHERE t.org_id = o.id), 0)
FROM public.organizations o
ON CONFLICT (org_id) DO UPDATE SET
    active_seats = EXCLUDED.active_seats,
    project_count = EXCLUDED.project_count,
    task_count = EXCLUDED.task_count,
    updated_at = NOW();

-- ------------------------------------------------------------------
-- 5. Stripe webhook event log (idempotency + audit)
-- ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stripe_events (
    id TEXT PRIMARY KEY,                  -- Stripe event id (evt_...)
    type TEXT NOT NULL,
    org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_org ON public.stripe_events(org_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON public.stripe_events(type);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
-- No policies = service role only (webhooks). Members never read this.

-- ------------------------------------------------------------------
-- 6. Entitlement helpers (used by app code & RLS)
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_entitlement(target_org UUID)
RETURNS TABLE (
    plan_id TEXT,
    subscription_status subscription_status,
    seat_limit INT,
    project_limit INT,
    seats_used INT,
    projects_used INT,
    features JSONB,
    is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        o.plan_id,
        o.subscription_status,
        p.seat_limit,
        p.project_limit,
        COALESCE(u.active_seats, 0) AS seats_used,
        COALESCE(u.project_count, 0) AS projects_used,
        p.features,
        -- Free plan is always "active". Paid plans require a healthy status.
        (o.plan_id = 'free'
         OR o.subscription_status IN ('trialing', 'active')
         OR (o.subscription_status = 'past_due' AND o.current_period_end > NOW() - INTERVAL '7 days')
        ) AS is_active
    FROM public.organizations o
    JOIN public.plans p ON p.id = o.plan_id
    LEFT JOIN public.org_usage u ON u.org_id = o.id
    WHERE o.id = target_org;
$$;

GRANT EXECUTE ON FUNCTION public.org_entitlement(UUID) TO authenticated;

COMMIT;
