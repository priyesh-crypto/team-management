-- ─────────────────────────────────────────────────────────────────────────────
-- Admin Enhancement Migration
-- Adds: system_config, content_pages, broadcasts.is_pinned_banner
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. System Configuration Table ────────────────────────────────────────────
-- Stores all "magic numbers" that previously lived in code/env vars.
-- Admins can edit these from the System Config UI without a deploy.

CREATE TABLE IF NOT EXISTS public.system_config (
    key          TEXT PRIMARY KEY,
    value        TEXT NOT NULL,
    type         TEXT NOT NULL DEFAULT 'string' CHECK (type IN ('string', 'number', 'boolean', 'json')),
    description  TEXT,
    updated_by   UUID REFERENCES auth.users(id),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read/write system config
CREATE POLICY "platform_admins_can_manage_system_config"
    ON public.system_config
    FOR ALL
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());

-- Seed with initial values
INSERT INTO public.system_config (key, value, type, description) VALUES
    ('trial_days',            '14',         'number',  'Length of the free trial period in days'),
    ('grace_period_days',     '3',          'number',  'Days past due before org is suspended'),
    ('max_export_rows',       '10000',      'number',  'Maximum rows returned in CSV/JSON exports'),
    ('support_email',         'support@taskflowpro.com', 'string', 'Public support email shown to users'),
    ('maintenance_mode',      'false',      'boolean', 'When true, all user dashboards show the maintenance banner'),
    ('maintenance_message',   'We are performing scheduled maintenance. We will be back shortly.', 'string', 'Message shown during maintenance mode'),
    ('ai_features_enabled',   'true',       'boolean', 'Master toggle for all AI-powered features'),
    ('max_file_upload_mb',    '25',         'number',  'Maximum file upload size in megabytes'),
    ('session_timeout_hours', '24',         'number',  'Inactivity timeout before users are logged out')
ON CONFLICT (key) DO NOTHING;

-- ── 2. Content Pages Table ────────────────────────────────────────────────────
-- Stores admin-editable Markdown for /terms, /privacy, /help, etc.
-- No deploy needed to update legal text.

CREATE TABLE IF NOT EXISTS public.content_pages (
    slug        TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    body_md     TEXT NOT NULL DEFAULT '',
    updated_by  UUID REFERENCES auth.users(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.content_pages ENABLE ROW LEVEL SECURITY;

-- Admins write; everyone reads
CREATE POLICY "platform_admins_can_write_content"
    ON public.content_pages
    FOR ALL
    USING (public.is_platform_admin())
    WITH CHECK (public.is_platform_admin());

CREATE POLICY "public_can_read_content"
    ON public.content_pages
    FOR SELECT
    USING (true);

INSERT INTO public.content_pages (slug, title, body_md) VALUES
    ('terms',   'Terms of Service', '# Terms of Service\n\n_Last updated: ' || to_char(NOW(), 'Month DD, YYYY') || '_\n\nPlease update this content from the Admin Portal → Content section.'),
    ('privacy', 'Privacy Policy',   '# Privacy Policy\n\n_Last updated: ' || to_char(NOW(), 'Month DD, YYYY') || '_\n\nPlease update this content from the Admin Portal → Content section.')
ON CONFLICT (slug) DO NOTHING;

-- ── 3. Broadcasts — Pinned Banner ─────────────────────────────────────────────
-- A pinned broadcast shows as a dismissible top banner on every dashboard.
-- Only one can be pinned at a time (enforced in application logic).

ALTER TABLE public.broadcasts
    ADD COLUMN IF NOT EXISTS is_pinned_banner BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_broadcasts_pinned
    ON public.broadcasts (is_pinned_banner)
    WHERE is_pinned_banner = TRUE;

-- ── 4. Materialized View Refresh RPC ─────────────────────────────────────────
-- Called by refreshWorkloadView() server action from the DB Control Center.

CREATE OR REPLACE FUNCTION public.refresh_workload_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.workload_summary;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_workload_summary() TO authenticated;
