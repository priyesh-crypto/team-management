-- ==============================================================================
-- Phase 3: Business-tier enterprise features
-- Idempotent — safe to re-run.
-- ==============================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- Feature 18: Guest role (client portal)
-- Add 'guest' to the org_role enum if not already present.
-- -----------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = 'org_role'::regtype AND enumlabel = 'guest'
    ) THEN
        ALTER TYPE org_role ADD VALUE 'guest';
    END IF;
END $$;

-- -----------------------------------------------------------------------
-- Feature 19: Approvals
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_workflows (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    description  TEXT,
    -- scope: which projects this workflow applies to (NULL = all)
    project_ids  UUID[],
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_by   UUID NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can read approval workflows" ON public.approval_workflows;
CREATE POLICY "Org members can read approval workflows" ON public.approval_workflows FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = approval_workflows.org_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Managers can manage approval workflows" ON public.approval_workflows;
CREATE POLICY "Managers can manage approval workflows" ON public.approval_workflows FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = approval_workflows.org_id AND user_id = auth.uid() AND role IN ('manager','admin','owner')
    ));

CREATE TABLE IF NOT EXISTS public.approval_steps (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id  UUID NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    step_order   INT NOT NULL,
    name         TEXT NOT NULL,
    approver_ids UUID[] NOT NULL,          -- user IDs who can approve
    require_all  BOOLEAN NOT NULL DEFAULT FALSE,  -- true = all must approve, false = any one
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.approval_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can read approval steps" ON public.approval_steps;
CREATE POLICY "Org members can read approval steps" ON public.approval_steps FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = approval_steps.org_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Managers can manage approval steps" ON public.approval_steps;
CREATE POLICY "Managers can manage approval steps" ON public.approval_steps FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = approval_steps.org_id AND user_id = auth.uid() AND role IN ('manager','admin','owner')
    ));

CREATE TABLE IF NOT EXISTS public.approval_requests (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    task_id      UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    workflow_id  UUID NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,
    current_step INT NOT NULL DEFAULT 0,
    status       TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | cancelled
    requested_by UUID NOT NULL,
    decided_by   UUID,
    decision_note TEXT,
    decided_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can read approval requests" ON public.approval_requests;
CREATE POLICY "Org members can read approval requests" ON public.approval_requests FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = approval_requests.org_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Org members can manage approval requests" ON public.approval_requests;
CREATE POLICY "Org members can manage approval requests" ON public.approval_requests FOR ALL
    USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = approval_requests.org_id AND user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_approval_requests_task ON public.approval_requests(task_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON public.approval_requests(status) WHERE status = 'pending';

-- -----------------------------------------------------------------------
-- Feature 22: Org-level audit log (mirrors platform_admin_actions pattern)
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_audit_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id     UUID NOT NULL,
    actor_email  TEXT,
    action       TEXT NOT NULL,   -- task_created, member_invited, status_changed, etc.
    resource_type TEXT,
    resource_id  UUID,
    payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address   INET,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.org_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers can read org audit logs" ON public.org_audit_logs;
CREATE POLICY "Managers can read org audit logs" ON public.org_audit_logs FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = org_audit_logs.org_id AND user_id = auth.uid() AND role IN ('manager','admin','owner')
    ));
-- Insert via server-side only (service role), no user-facing insert policy

CREATE INDEX IF NOT EXISTS idx_org_audit_logs_org ON public.org_audit_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_audit_logs_actor ON public.org_audit_logs(actor_id);

-- -----------------------------------------------------------------------
-- Feature 23: Webhooks & API keys
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_webhooks (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    url          TEXT NOT NULL,
    secret       TEXT NOT NULL,  -- HMAC signing secret
    events       TEXT[] NOT NULL DEFAULT '{}',  -- task.created, task.updated, etc.
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_by   UUID NOT NULL,
    last_triggered_at TIMESTAMPTZ,
    failure_count INT NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.org_webhooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers can manage org webhooks" ON public.org_webhooks;
CREATE POLICY "Managers can manage org webhooks" ON public.org_webhooks FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = org_webhooks.org_id AND user_id = auth.uid() AND role IN ('manager','admin','owner')
    ));

CREATE TABLE IF NOT EXISTS public.api_keys (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by   UUID NOT NULL,
    name         TEXT NOT NULL,
    key_prefix   TEXT NOT NULL,    -- first 8 chars, shown in UI
    key_hash     TEXT NOT NULL UNIQUE,  -- SHA-256 of full key; full key shown once at creation
    scopes       TEXT[] NOT NULL DEFAULT '{"read"}',  -- read | write | admin
    last_used_at TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers can manage api keys" ON public.api_keys;
CREATE POLICY "Managers can manage api keys" ON public.api_keys FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = api_keys.org_id AND user_id = auth.uid() AND role IN ('manager','admin','owner')
    ));

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash) WHERE is_active = TRUE;

-- -----------------------------------------------------------------------
-- Feature 21: SAML SSO config per org
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_sso (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    provider     TEXT NOT NULL DEFAULT 'saml',  -- saml | oidc
    -- SAML config
    idp_metadata_url TEXT,
    idp_entity_id    TEXT,
    idp_sso_url      TEXT,
    idp_certificate  TEXT,
    -- OIDC config
    client_id        TEXT,
    client_secret    TEXT,
    discovery_url    TEXT,
    -- state
    is_active    BOOLEAN NOT NULL DEFAULT FALSE,
    configured_by UUID NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.org_sso ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners can manage sso config" ON public.org_sso;
CREATE POLICY "Owners can manage sso config" ON public.org_sso FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = org_sso.org_id AND user_id = auth.uid() AND role IN ('admin','owner')
    ));

COMMIT;
