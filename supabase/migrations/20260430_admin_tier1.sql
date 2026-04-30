-- ==============================================================================
-- Admin Tier 1: Impersonation, Suspend, Credits, Feature Overrides
-- Additive-only. Safe to re-run (idempotent).
-- ==============================================================================

BEGIN;

-- ── 1. Suspend columns on organizations ───────────────────────────────────────

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS suspended_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

-- ── 2. Impersonation sessions ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id  UUID NOT NULL,
    target_org_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    target_user_id UUID,
    started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at       TIMESTAMPTZ,
    actions_count  INT NOT NULL DEFAULT 0
);

ALTER TABLE public.impersonation_sessions ADD COLUMN IF NOT EXISTS actions_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS impersonation_sessions_admin_idx
    ON public.impersonation_sessions (admin_user_id, started_at DESC);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins manage impersonation sessions" ON public.impersonation_sessions;
CREATE POLICY "Platform admins manage impersonation sessions"
    ON public.impersonation_sessions FOR ALL
    USING (public.is_platform_admin());

-- ── 3. Org credits ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_credits (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    amount_cents INT NOT NULL,
    currency     TEXT NOT NULL DEFAULT 'USD',
    reason       TEXT NOT NULL,
    applied_at   TIMESTAMPTZ,
    created_by   UUID NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.org_credits ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS org_credits_org_idx
    ON public.org_credits (org_id, created_at DESC);

ALTER TABLE public.org_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins manage credits" ON public.org_credits;
CREATE POLICY "Platform admins manage credits"
    ON public.org_credits FOR ALL
    USING (public.is_platform_admin());

-- ── 4. Per-org feature overrides ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_feature_overrides (
    org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    enabled     BOOLEAN NOT NULL,
    updated_by  UUID NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (org_id, feature_key)
);

ALTER TABLE public.org_feature_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members read their overrides" ON public.org_feature_overrides;
CREATE POLICY "Org members read their overrides"
    ON public.org_feature_overrides FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = org_feature_overrides.org_id AND user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Platform admins manage overrides" ON public.org_feature_overrides;
CREATE POLICY "Platform admins manage overrides"
    ON public.org_feature_overrides FOR ALL
    USING (public.is_platform_admin());

COMMIT;
