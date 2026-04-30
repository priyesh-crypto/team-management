-- ==============================================================================
-- Phase 7: GitHub Integration & Extended REST API
-- Additive-only. Safe to re-run (idempotent).
-- ==============================================================================

BEGIN;

-- ── 1. Feature flags ──────────────────────────────────────────────────────────

UPDATE public.plans
SET features = features
    || '{"github_integration":false,"extended_api":false}'::jsonb
WHERE id IN ('free', 'pro', 'business');

UPDATE public.plans
SET features = features
    || '{"github_integration":true,"extended_api":true}'::jsonb
WHERE id IN ('pro', 'business');

-- ── 2. GitHub connections ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.github_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    github_org      TEXT,
    installation_id TEXT,
    access_token    TEXT,            -- encrypted at rest via Supabase Vault in production
    repos           JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    connected_by    UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage github connections" ON public.github_connections;
CREATE POLICY "Admins can manage github connections" ON public.github_connections FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = github_connections.org_id AND user_id = auth.uid()
          AND role IN ('admin','owner')
    ));

-- ── 3. Task GitHub links ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_github_links (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    repo        TEXT NOT NULL,   -- owner/repo
    link_type   TEXT NOT NULL DEFAULT 'pr',  -- pr | commit | issue
    ref_number  INT,             -- PR / issue number
    ref_sha     TEXT,            -- commit SHA
    title       TEXT,
    state       TEXT,            -- open | closed | merged
    url         TEXT,
    linked_by   UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS task_github_links_task_idx ON public.task_github_links (task_id);

ALTER TABLE public.task_github_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can read github links" ON public.task_github_links;
CREATE POLICY "Org members can read github links" ON public.task_github_links FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = task_github_links.org_id AND user_id = auth.uid()
    ));
DROP POLICY IF EXISTS "Members can manage github links" ON public.task_github_links;
CREATE POLICY "Members can manage github links" ON public.task_github_links FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = task_github_links.org_id AND user_id = auth.uid()
    ));

COMMIT;
