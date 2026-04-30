-- ==============================================================================
-- Phase 2: AI + Integrations schema
-- Idempotent — safe to re-run.
-- ==============================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- Feature 9: AI task breakdown suggestions
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_suggestions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    task_id      UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    created_by   UUID NOT NULL,
    type         TEXT NOT NULL DEFAULT 'subtask_breakdown', -- subtask_breakdown | due_date | summary
    input_prompt TEXT,
    suggestions  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- array of suggested subtasks / text
    model        TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    accepted     BOOLEAN,  -- null=pending, true=user accepted, false=rejected
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can read ai suggestions" ON public.ai_suggestions;
CREATE POLICY "Org members can read ai suggestions" ON public.ai_suggestions FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = ai_suggestions.org_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can manage their own ai suggestions" ON public.ai_suggestions;
CREATE POLICY "Users can manage their own ai suggestions" ON public.ai_suggestions FOR ALL
    USING (created_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_task ON public.ai_suggestions(task_id);

-- -----------------------------------------------------------------------
-- Feature 10: AI weekly summaries
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_summaries (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    week_start   DATE NOT NULL,
    summary_text TEXT NOT NULL,
    model        TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    stats_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, week_start)
);

ALTER TABLE public.ai_summaries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can read ai summaries" ON public.ai_summaries;
CREATE POLICY "Org members can read ai summaries" ON public.ai_summaries FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = ai_summaries.org_id AND user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_ai_summaries_org_week ON public.ai_summaries(org_id, week_start DESC);

-- -----------------------------------------------------------------------
-- Feature 12: Integrations (Slack, etc.)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_integrations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider     TEXT NOT NULL,   -- 'slack' | 'microsoft_teams' | 'google_chat'
    -- encrypted token storage (encrypt at app layer before insert)
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    -- provider-specific config (channel IDs, webhook URLs, etc.)
    config       JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    connected_by UUID NOT NULL,
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, provider)
);

ALTER TABLE public.org_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org managers can manage integrations" ON public.org_integrations;
CREATE POLICY "Org managers can manage integrations" ON public.org_integrations FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = org_integrations.org_id AND user_id = auth.uid() AND role IN ('manager','admin','owner')
    ));
DROP POLICY IF EXISTS "Org members can read integrations" ON public.org_integrations;
CREATE POLICY "Org members can read integrations" ON public.org_integrations FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = org_integrations.org_id AND user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_org_integrations_org ON public.org_integrations(org_id);

-- -----------------------------------------------------------------------
-- Feature 13: Calendar connections
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_connections (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL,
    provider     TEXT NOT NULL,   -- 'google' | 'microsoft'
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    calendar_id  TEXT,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, provider)
);

ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own calendar connections" ON public.calendar_connections;
CREATE POLICY "Users can manage their own calendar connections" ON public.calendar_connections FOR ALL
    USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_calendar_connections_user ON public.calendar_connections(user_id);

-- -----------------------------------------------------------------------
-- Feature 14: Task dependencies (Gantt)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.task_dependencies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    task_id         UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    depends_on_id   UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    dependency_type TEXT NOT NULL DEFAULT 'finish_to_start', -- finish_to_start | start_to_start
    created_by      UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (task_id, depends_on_id),
    CHECK (task_id <> depends_on_id)
);

ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can read task dependencies" ON public.task_dependencies;
CREATE POLICY "Org members can read task dependencies" ON public.task_dependencies FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = task_dependencies.org_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Org members can manage task dependencies" ON public.task_dependencies;
CREATE POLICY "Org members can manage task dependencies" ON public.task_dependencies FOR ALL
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = task_dependencies.org_id AND user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_task_deps_task ON public.task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on ON public.task_dependencies(depends_on_id);

-- -----------------------------------------------------------------------
-- Feature 15: Custom fields
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_field_defs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    project_id   UUID,   -- NULL = org-wide
    name         TEXT NOT NULL,
    field_type   TEXT NOT NULL DEFAULT 'text',  -- text | number | date | select | multi_select | checkbox | url
    options      JSONB,  -- for select/multi_select: ["Option A", "Option B"]
    is_required  BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order   INT NOT NULL DEFAULT 0,
    created_by   UUID NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.custom_field_defs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can read custom field defs" ON public.custom_field_defs;
CREATE POLICY "Org members can read custom field defs" ON public.custom_field_defs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = custom_field_defs.org_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Managers can manage custom field defs" ON public.custom_field_defs;
CREATE POLICY "Managers can manage custom field defs" ON public.custom_field_defs FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = custom_field_defs.org_id AND user_id = auth.uid() AND role IN ('manager','admin','owner')
    ));

CREATE INDEX IF NOT EXISTS idx_custom_field_defs_org ON public.custom_field_defs(org_id);

CREATE TABLE IF NOT EXISTS public.custom_field_values (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    field_def_id UUID NOT NULL REFERENCES public.custom_field_defs(id) ON DELETE CASCADE,
    task_id      UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    value_text   TEXT,
    value_number NUMERIC,
    value_date   DATE,
    value_json   JSONB,   -- for multi_select, checkbox
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (field_def_id, task_id)
);

ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can read custom field values" ON public.custom_field_values;
CREATE POLICY "Org members can read custom field values" ON public.custom_field_values FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = custom_field_values.org_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Org members can manage custom field values" ON public.custom_field_values;
CREATE POLICY "Org members can manage custom field values" ON public.custom_field_values FOR ALL
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = custom_field_values.org_id AND user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_custom_field_values_task ON public.custom_field_values(task_id);

-- -----------------------------------------------------------------------
-- Feature 16: Forms (public intake → creates tasks)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forms (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by   UUID NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT,
    -- where created tasks land
    workspace_id UUID,
    project_id   UUID,
    default_assignee_id UUID,
    default_priority TEXT NOT NULL DEFAULT 'Medium',
    -- form schema: array of field definitions
    fields       JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    submit_message TEXT NOT NULL DEFAULT 'Thank you! Your request has been submitted.',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org managers can manage forms" ON public.forms;
CREATE POLICY "Org managers can manage forms" ON public.forms FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = forms.org_id AND user_id = auth.uid() AND role IN ('manager','admin','owner')
    ));
DROP POLICY IF EXISTS "Public forms are publicly readable" ON public.forms;
CREATE POLICY "Public forms are publicly readable" ON public.forms FOR SELECT USING (is_active = TRUE);

CREATE TABLE IF NOT EXISTS public.form_submissions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    form_id      UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
    task_id      UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
    submitter_email TEXT,
    submitter_name  TEXT,
    data         JSONB NOT NULL DEFAULT '{}'::jsonb,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert form submissions" ON public.form_submissions;
CREATE POLICY "Anyone can insert form submissions" ON public.form_submissions FOR INSERT WITH CHECK (TRUE);
DROP POLICY IF EXISTS "Org members can read form submissions" ON public.form_submissions;
CREATE POLICY "Org members can read form submissions" ON public.form_submissions FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = form_submissions.org_id AND user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_form_submissions_form ON public.form_submissions(form_id);

-- -----------------------------------------------------------------------
-- Feature 17: Automations
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_rules (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by   UUID NOT NULL,
    name         TEXT NOT NULL,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    -- trigger config
    trigger_type TEXT NOT NULL,  -- task_created | task_status_changed | task_overdue | comment_added | due_date_approaching
    trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- action config
    action_type  TEXT NOT NULL,  -- assign_user | change_status | send_notification | send_slack | create_task | add_label
    action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- execution tracking
    run_count    INT NOT NULL DEFAULT 0,
    last_run_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can read automation rules" ON public.automation_rules;
CREATE POLICY "Org members can read automation rules" ON public.automation_rules FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = automation_rules.org_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Managers can manage automation rules" ON public.automation_rules;
CREATE POLICY "Managers can manage automation rules" ON public.automation_rules FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = automation_rules.org_id AND user_id = auth.uid() AND role IN ('manager','admin','owner')
    ));

CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON public.automation_rules(org_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger ON public.automation_rules(trigger_type) WHERE is_active = TRUE;

COMMIT;
