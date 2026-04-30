-- ==============================================================================
-- Admin Tier 2: Funnel analytics, Broadcasts, Coupons
-- Additive-only. Safe to re-run (idempotent).
-- ==============================================================================

BEGIN;

-- ── 1. Broadcasts ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.broadcasts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title          TEXT NOT NULL,
    body           TEXT NOT NULL,
    target_filter  JSONB NOT NULL DEFAULT '{}',  -- { plans: [], min_seats: N, all: true }
    channels       TEXT[] NOT NULL DEFAULT '{in_app}', -- 'in_app' | 'email'
    scheduled_for  TIMESTAMPTZ,
    sent_at        TIMESTAMPTZ,
    created_by     UUID NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
ALTER TABLE public.broadcasts ADD COLUMN IF NOT EXISTS sent_at       TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS broadcasts_created_idx ON public.broadcasts (created_at DESC);

ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins manage broadcasts" ON public.broadcasts;
CREATE POLICY "Platform admins manage broadcasts"
    ON public.broadcasts FOR ALL
    USING (public.is_platform_admin());

-- ── 2. Broadcast deliveries ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.broadcast_deliveries (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID NOT NULL REFERENCES public.broadcasts(id) ON DELETE CASCADE,
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at      TIMESTAMPTZ,
    clicked_at   TIMESTAMPTZ,
    UNIQUE (broadcast_id, user_id)
);

ALTER TABLE public.broadcast_deliveries ADD COLUMN IF NOT EXISTS read_at    TIMESTAMPTZ;
ALTER TABLE public.broadcast_deliveries ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS broadcast_deliveries_broadcast_idx
    ON public.broadcast_deliveries (broadcast_id);
CREATE INDEX IF NOT EXISTS broadcast_deliveries_user_idx
    ON public.broadcast_deliveries (user_id, read_at);

ALTER TABLE public.broadcast_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own deliveries" ON public.broadcast_deliveries;
CREATE POLICY "Users read own deliveries"
    ON public.broadcast_deliveries FOR SELECT
    USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update own deliveries" ON public.broadcast_deliveries;
CREATE POLICY "Users update own deliveries"
    ON public.broadcast_deliveries FOR UPDATE
    USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Platform admins manage deliveries" ON public.broadcast_deliveries;
CREATE POLICY "Platform admins manage deliveries"
    ON public.broadcast_deliveries FOR ALL
    USING (public.is_platform_admin());

-- ── 3. Coupons ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coupons (
    code              TEXT PRIMARY KEY,
    stripe_coupon_id  TEXT,
    percent_off       INT,                          -- 0-100 or NULL
    amount_off_cents  INT,                          -- fixed amount or NULL
    currency          TEXT NOT NULL DEFAULT 'USD',
    valid_until       TIMESTAMPTZ,
    max_redemptions   INT,                          -- NULL = unlimited
    redemptions       INT NOT NULL DEFAULT 0,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_by        UUID NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS stripe_coupon_id TEXT;
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS is_active         BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS coupons_active_idx ON public.coupons (is_active, valid_until);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins manage coupons" ON public.coupons;
CREATE POLICY "Platform admins manage coupons"
    ON public.coupons FOR ALL
    USING (public.is_platform_admin());

-- ── 4. Coupon redemptions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_code TEXT NOT NULL REFERENCES public.coupons(code) ON DELETE CASCADE,
    org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (coupon_code, org_id)
);

CREATE INDEX IF NOT EXISTS coupon_redemptions_coupon_idx
    ON public.coupon_redemptions (coupon_code, redeemed_at DESC);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins manage redemptions" ON public.coupon_redemptions;
CREATE POLICY "Platform admins manage redemptions"
    ON public.coupon_redemptions FOR ALL
    USING (public.is_platform_admin());

COMMIT;
