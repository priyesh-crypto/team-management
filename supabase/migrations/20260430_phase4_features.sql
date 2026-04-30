-- ==============================================================================
-- Phase 4: Enterprise tier — SSO, white-labeling, data export, custom roles
-- Additive-only. Safe to re-run (idempotent).
-- ==============================================================================

BEGIN;

-- ── 1. Extend feature flags ──────────────────────────────────────────────────

UPDATE public.plans
SET features = features
    || '{"sso":false,"custom_roles":false,"white_labeling":false,"data_export":false}'::jsonb
WHERE id IN ('free', 'pro', 'business');

-- Business gets all new flags
UPDATE public.plans
SET features = features
    || '{"sso":true,"custom_roles":true,"white_labeling":true,"data_export":true}'::jsonb
WHERE id = 'business';

-- ── 2. Org branding (white-labeling) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.org_branding (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    logo_url        TEXT,
    favicon_url     TEXT,
    primary_color   TEXT NOT NULL DEFAULT '#0c64ef',
    accent_color    TEXT NOT NULL DEFAULT '#34c759',
    org_display_name TEXT,
    custom_domain   TEXT,
    support_email   TEXT,
    updated_by      UUID,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.org_branding ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can read branding" ON public.org_branding;
CREATE POLICY "Members can read branding" ON public.org_branding FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = org_branding.org_id AND user_id = auth.uid()
    ));
DROP POLICY IF EXISTS "Admins can manage branding" ON public.org_branding;
CREATE POLICY "Admins can manage branding" ON public.org_branding FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = org_branding.org_id AND user_id = auth.uid()
          AND role IN ('admin', 'owner')
    ));

-- ── 3. Custom roles ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.custom_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_system   BOOLEAN NOT NULL DEFAULT FALSE,
    created_by  UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, name)
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can read custom roles" ON public.custom_roles;
CREATE POLICY "Members can read custom roles" ON public.custom_roles FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = custom_roles.org_id AND user_id = auth.uid()
    ));
DROP POLICY IF EXISTS "Admins can manage custom roles" ON public.custom_roles;
CREATE POLICY "Admins can manage custom roles" ON public.custom_roles FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = custom_roles.org_id AND user_id = auth.uid()
          AND role IN ('admin', 'owner')
    ));

CREATE TABLE IF NOT EXISTS public.custom_role_assignments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id         UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id        UUID NOT NULL,
    custom_role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
    assigned_by    UUID,
    assigned_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, user_id, custom_role_id)
);

ALTER TABLE public.custom_role_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Members can read role assignments" ON public.custom_role_assignments;
CREATE POLICY "Members can read role assignments" ON public.custom_role_assignments FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = custom_role_assignments.org_id AND user_id = auth.uid()
    ));
DROP POLICY IF EXISTS "Admins can manage role assignments" ON public.custom_role_assignments;
CREATE POLICY "Admins can manage role assignments" ON public.custom_role_assignments FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = custom_role_assignments.org_id AND user_id = auth.uid()
          AND role IN ('admin', 'owner')
    ));

-- ── 4. Data export audit trail ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.data_exports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL,
    export_type TEXT NOT NULL,   -- tasks | members | time_entries | full
    format      TEXT NOT NULL DEFAULT 'csv',
    status      TEXT NOT NULL DEFAULT 'pending',  -- pending | ready | expired
    row_count   INT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.data_exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage exports" ON public.data_exports;
CREATE POLICY "Admins can manage exports" ON public.data_exports FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = data_exports.org_id AND user_id = auth.uid()
          AND role IN ('admin', 'owner', 'manager')
    ));

COMMIT;
