-- ==============================================================================
-- REGIONAL PRICING MIGRATION
-- Adds per-country pricing on top of the base plans table.
-- Each plan can have multiple price points (one per country/currency combo)
-- plus a 'DEFAULT' fallback used when the customer's country isn't mapped.
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.plan_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id TEXT NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
    country_code TEXT NOT NULL,            -- ISO 3166-1 alpha-2, or 'DEFAULT'
    currency TEXT NOT NULL,                -- ISO 4217 (USD, EUR, INR, ...)
    price_monthly_cents INT NOT NULL,
    stripe_price_id TEXT,                  -- Stripe Price for this region/currency
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (plan_id, country_code)
);

CREATE INDEX IF NOT EXISTS idx_plan_prices_plan ON public.plan_prices(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_prices_country ON public.plan_prices(country_code);

ALTER TABLE public.plan_prices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plan prices are world-readable" ON public.plan_prices;
CREATE POLICY "Plan prices are world-readable" ON public.plan_prices
    FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Platform admins can manage plan prices" ON public.plan_prices;
CREATE POLICY "Platform admins can manage plan prices" ON public.plan_prices
    FOR ALL USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- Track customer billing country on the org (set at checkout, editable in admin)
ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS billing_country TEXT;

-- Resolver: given a plan + country, return the best matching price.
-- Falls back to DEFAULT when no country-specific row exists.
CREATE OR REPLACE FUNCTION public.resolve_plan_price(target_plan TEXT, target_country TEXT)
RETURNS TABLE (
    country_code TEXT,
    currency TEXT,
    price_monthly_cents INT,
    stripe_price_id TEXT
)
LANGUAGE sql
STABLE
AS $$
    SELECT country_code, currency, price_monthly_cents, stripe_price_id
    FROM public.plan_prices
    WHERE plan_id = target_plan
      AND is_active = TRUE
      AND country_code = COALESCE(target_country, 'DEFAULT')
    UNION ALL
    SELECT country_code, currency, price_monthly_cents, stripe_price_id
    FROM public.plan_prices
    WHERE plan_id = target_plan
      AND is_active = TRUE
      AND country_code = 'DEFAULT'
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_plan_price(TEXT, TEXT) TO authenticated, anon;

-- Seed DEFAULT prices from existing plans table so nothing breaks
INSERT INTO public.plan_prices (plan_id, country_code, currency, price_monthly_cents, stripe_price_id)
SELECT id, 'DEFAULT', 'USD', price_monthly_cents, stripe_price_id
FROM public.plans
WHERE price_monthly_cents > 0
ON CONFLICT (plan_id, country_code) DO NOTHING;

COMMIT;
