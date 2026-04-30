-- ==============================================================================
-- Phase 1: All new tables for quick-win features
-- Idempotent — safe to re-run. All schema changes are additive only.
-- Existing tables and columns are never altered, renamed, or dropped.
-- ==============================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- Feature 1: Recurring tasks
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_task_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by  UUID NOT NULL,
    name        TEXT NOT NULL,
    notes       TEXT,
    priority    TEXT NOT NULL DEFAULT 'Medium',
    -- recurrence
    frequency   TEXT NOT NULL DEFAULT 'weekly', -- daily | weekly | monthly
    interval    INT  NOT NULL DEFAULT 1,         -- every N freq units
    day_of_week INT,                             -- 0=Sun..6=Sat (weekly)
    day_of_month INT,                            -- 1-31 (monthly)
    -- timing
    estimated_hours NUMERIC(6,2),
    -- employees to assign (array of profile IDs)
    assignee_ids UUID[],
    workspace_id UUID,
    project_id   UUID,
    -- lifecycle
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.recurring_task_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read recurring templates" ON public.recurring_task_templates;
CREATE POLICY "Org members can read recurring templates"
    ON public.recurring_task_templates FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = recurring_task_templates.org_id AND user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Managers/owners can manage recurring templates" ON public.recurring_task_templates;
CREATE POLICY "Managers/owners can manage recurring templates"
    ON public.recurring_task_templates FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = recurring_task_templates.org_id
          AND user_id = auth.uid()
          AND role IN ('manager','admin','owner')
    ));

CREATE INDEX IF NOT EXISTS idx_recurring_templates_org ON public.recurring_task_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_recurring_templates_next_run ON public.recurring_task_templates(next_run_at) WHERE is_active = TRUE;

-- -----------------------------------------------------------------------
-- Feature 2: Task templates
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_templates (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by   UUID NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT,
    -- template body stored as JSONB (name, notes, priority, subtasks, etc.)
    template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_public    BOOLEAN NOT NULL DEFAULT TRUE, -- visible to all org members
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read task templates" ON public.task_templates;
CREATE POLICY "Org members can read task templates"
    ON public.task_templates FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = task_templates.org_id AND user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Org members can manage their own task templates" ON public.task_templates;
CREATE POLICY "Org members can manage their own task templates"
    ON public.task_templates FOR ALL
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.organization_members
            WHERE org_id = task_templates.org_id
              AND user_id = auth.uid()
              AND role IN ('manager','admin','owner')
        )
    );

CREATE INDEX IF NOT EXISTS idx_task_templates_org ON public.task_templates(org_id);

-- -----------------------------------------------------------------------
-- Feature 3: Custom statuses
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.project_statuses (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id UUID NOT NULL,   -- scoped to a project
    name       TEXT NOT NULL,
    color      TEXT NOT NULL DEFAULT '#86868b',
    sort_order INT  NOT NULL DEFAULT 0,
    is_done    BOOLEAN NOT NULL DEFAULT FALSE, -- counts as "completed" for progress
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.project_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can read project statuses" ON public.project_statuses;
CREATE POLICY "Org members can read project statuses"
    ON public.project_statuses FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = project_statuses.org_id AND user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Managers/owners can manage project statuses" ON public.project_statuses;
CREATE POLICY "Managers/owners can manage project statuses"
    ON public.project_statuses FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = project_statuses.org_id
          AND user_id = auth.uid()
          AND role IN ('manager','admin','owner')
    ));

CREATE INDEX IF NOT EXISTS idx_project_statuses_project ON public.project_statuses(project_id);

-- Add nullable custom status column to tasks (legacy status enum stays unchanged)
ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS custom_status_id UUID REFERENCES public.project_statuses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_custom_status ON public.tasks(custom_status_id) WHERE custom_status_id IS NOT NULL;

-- -----------------------------------------------------------------------
-- Feature 4: Saved views
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_views (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    owner_id   UUID NOT NULL,   -- the user who saved it
    name       TEXT NOT NULL,
    -- serialised filter / sort state (what columns, search, grouping, etc.)
    view_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_shared  BOOLEAN NOT NULL DEFAULT FALSE, -- share with whole org
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own and shared views" ON public.saved_views;
CREATE POLICY "Users can read own and shared views"
    ON public.saved_views FOR SELECT
    USING (
        owner_id = auth.uid()
        OR (
            is_shared = TRUE
            AND EXISTS (
                SELECT 1 FROM public.organization_members
                WHERE org_id = saved_views.org_id AND user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can manage their own views" ON public.saved_views;
CREATE POLICY "Users can manage their own views"
    ON public.saved_views FOR ALL
    USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_saved_views_org_owner ON public.saved_views(org_id, owner_id);

-- -----------------------------------------------------------------------
-- Feature 5: Time tracker (granular entries; existing hours_spent kept)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.time_entries (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL,
    started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    stopped_at  TIMESTAMPTZ,               -- NULL = timer running
    duration_seconds INT,                  -- computed on stop
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their org time entries" ON public.time_entries;
CREATE POLICY "Users can read their org time entries"
    ON public.time_entries FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = time_entries.org_id AND user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Users can manage their own time entries" ON public.time_entries;
CREATE POLICY "Users can manage their own time entries"
    ON public.time_entries FOR ALL
    USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_time_entries_task ON public.time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user ON public.time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_running ON public.time_entries(user_id, task_id) WHERE stopped_at IS NULL;

-- -----------------------------------------------------------------------
-- Feature 7: Public share links  (Feature 6 bulk-actions is UI-only)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.share_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by  UUID NOT NULL,
    -- what is being shared
    resource_type TEXT NOT NULL DEFAULT 'project', -- 'project' | 'task'
    resource_id   UUID NOT NULL,
    -- token (URL-safe random string)
    token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64url'),
    -- optional expiry
    expires_at  TIMESTAMPTZ,
    -- permissions
    allow_comments BOOLEAN NOT NULL DEFAULT FALSE,
    -- lifecycle
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    view_count  INT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.share_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can manage share tokens" ON public.share_tokens;
CREATE POLICY "Org members can manage share tokens"
    ON public.share_tokens FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = share_tokens.org_id AND user_id = auth.uid()
    ));

-- Public read via token (no auth required — enforced at app layer)
DROP POLICY IF EXISTS "Public share token lookup" ON public.share_tokens;
CREATE POLICY "Public share token lookup"
    ON public.share_tokens FOR SELECT
    USING (is_active = TRUE AND (expires_at IS NULL OR expires_at > NOW()));

CREATE INDEX IF NOT EXISTS idx_share_tokens_token ON public.share_tokens(token);
CREATE INDEX IF NOT EXISTS idx_share_tokens_resource ON public.share_tokens(resource_type, resource_id);

COMMIT;
