-- ==============================================================================
-- CATCH-UP MIGRATION
--
-- Consolidates every Phase 4–7 and Admin Tier 1–3 migration into ONE
-- idempotent script. Run this once in Supabase if you've been hitting
-- runtime errors like:
--   - "Could not find the 'title' column of 'notifications' in the schema cache"
--   - "relation 'org_feature_overrides' does not exist"
--   - "relation 'task_comments' does not exist"
--   - dashboard fails to load with column errors
--
-- This file is safe to run multiple times. It uses CREATE TABLE IF NOT EXISTS,
-- ALTER TABLE ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS — so re-running
-- on an already-up-to-date database is a no-op.
--
-- It does NOT replace your existing per-phase migration files. Apply this to
-- bring a stale environment up-to-date in one go.
-- ==============================================================================

BEGIN;

-- =============================================================================
-- ADMIN TIER 1 — must be first; the dashboard layout reads these columns
-- =============================================================================

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS suspended_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspended_reason TEXT;

CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id  UUID NOT NULL,
    target_org_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    target_user_id UUID,
    started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at       TIMESTAMPTZ,
    actions_count  INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS impersonation_sessions_admin_idx
    ON public.impersonation_sessions (admin_user_id, started_at DESC);
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins manage impersonation sessions" ON public.impersonation_sessions;
CREATE POLICY "Platform admins manage impersonation sessions"
    ON public.impersonation_sessions FOR ALL
    USING (public.is_platform_admin());

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
CREATE INDEX IF NOT EXISTS org_credits_org_idx ON public.org_credits (org_id, created_at DESC);
ALTER TABLE public.org_credits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins manage credits" ON public.org_credits;
CREATE POLICY "Platform admins manage credits"
    ON public.org_credits FOR ALL
    USING (public.is_platform_admin());

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

-- =============================================================================
-- PHASE 5 — notification columns + comments + reactions
-- =============================================================================

UPDATE public.plans
SET features = features
    || '{"notifications":false,"task_comments":false,"comment_reactions":false}'::jsonb
WHERE id IN ('free', 'pro', 'business');

UPDATE public.plans
SET features = features
    || '{"notifications":true,"task_comments":true,"comment_reactions":true}'::jsonb
WHERE id IN ('pro', 'business');

CREATE TABLE IF NOT EXISTS public.notifications (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL,
    type          TEXT NOT NULL,
    message       TEXT,
    is_read       BOOLEAN NOT NULL DEFAULT FALSE,
    task_id       UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Legacy columns (additive — keeps the existing dashboard bell working)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message  TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS task_id  UUID;
-- Phase 5 columns (used by the new NotificationsBell + comment mentions)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS title         TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body          TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS resource_id   UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id      UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_email   TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at       TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS notifications_user_idx
    ON public.notifications (user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;
CREATE POLICY "Users can manage own notifications"
    ON public.notifications FOR ALL
    USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL,
    event_type TEXT NOT NULL,
    in_app     BOOLEAN NOT NULL DEFAULT TRUE,
    email      BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, user_id, event_type)
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own prefs" ON public.notification_preferences;
CREATE POLICY "Users manage own prefs" ON public.notification_preferences FOR ALL
    USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.task_comments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id    UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL,
    content    TEXT NOT NULL,
    mentions   UUID[] NOT NULL DEFAULT '{}',
    edited_at  TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.task_comments ADD COLUMN IF NOT EXISTS mentions  UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE public.task_comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS task_comments_task_idx ON public.task_comments (task_id, created_at);
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can read comments" ON public.task_comments;
CREATE POLICY "Org members can read comments" ON public.task_comments FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.organization_members
        WHERE org_id = task_comments.org_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Org members can create comments" ON public.task_comments;
CREATE POLICY "Org members can create comments" ON public.task_comments FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members
        WHERE org_id = task_comments.org_id AND user_id = auth.uid()));
DROP POLICY IF EXISTS "Comment authors can edit own" ON public.task_comments;
CREATE POLICY "Comment authors can edit own" ON public.task_comments FOR UPDATE
    USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Comment authors and admins can delete" ON public.task_comments;
CREATE POLICY "Comment authors and admins can delete" ON public.task_comments FOR DELETE
    USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.organization_members
        WHERE org_id = task_comments.org_id AND user_id = auth.uid() AND role IN ('admin','owner')));

CREATE TABLE IF NOT EXISTS public.comment_reactions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES public.task_comments(id) ON DELETE CASCADE,
    org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL,
    emoji      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'comment_reactions_comment_id_user_id_emoji_key'
    ) THEN
        ALTER TABLE public.comment_reactions
            ADD CONSTRAINT comment_reactions_comment_id_user_id_emoji_key
            UNIQUE (comment_id, user_id, emoji);
    END IF;
END$$;
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can manage reactions" ON public.comment_reactions;
CREATE POLICY "Org members can manage reactions" ON public.comment_reactions FOR ALL
    USING (EXISTS (SELECT 1 FROM public.organization_members
        WHERE org_id = comment_reactions.org_id AND user_id = auth.uid()));

-- =============================================================================
-- PHASE 6 — milestones, sprints, workload
-- =============================================================================

UPDATE public.plans
SET features = features
    || '{"milestones":false,"sprints":false,"workload_view":false}'::jsonb
WHERE id IN ('free', 'pro', 'business');

UPDATE public.plans SET features = features || '{"milestones":true,"sprints":true}'::jsonb
WHERE id IN ('pro', 'business');
UPDATE public.plans SET features = features || '{"workload_view":true}'::jsonb
WHERE id = 'business';

CREATE TABLE IF NOT EXISTS public.milestones (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id  UUID,
    name          TEXT NOT NULL,
    description   TEXT,
    due_date      TIMESTAMPTZ,
    status        TEXT NOT NULL DEFAULT 'active',
    color         TEXT,
    created_by    UUID NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS milestones_org_idx ON public.milestones (org_id, status, due_date);
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members manage milestones" ON public.milestones;
CREATE POLICY "Org members manage milestones" ON public.milestones FOR ALL
    USING (EXISTS (SELECT 1 FROM public.organization_members
        WHERE org_id = milestones.org_id AND user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.sprints (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID,
    name         TEXT NOT NULL,
    goal         TEXT,
    start_date   TIMESTAMPTZ,
    end_date     TIMESTAMPTZ,
    status       TEXT NOT NULL DEFAULT 'planned',
    created_by   UUID NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sprints_org_idx ON public.sprints (org_id, status, start_date);
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members manage sprints" ON public.sprints;
CREATE POLICY "Org members manage sprints" ON public.sprints FOR ALL
    USING (EXISTS (SELECT 1 FROM public.organization_members
        WHERE org_id = sprints.org_id AND user_id = auth.uid()));

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS milestone_id UUID;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sprint_id    UUID;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS story_points INT;

CREATE TABLE IF NOT EXISTS public.workload_snapshots (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL,
    snapshot_date DATE NOT NULL,
    task_count    INT NOT NULL DEFAULT 0,
    hours_planned NUMERIC NOT NULL DEFAULT 0,
    UNIQUE (org_id, user_id, snapshot_date)
);
ALTER TABLE public.workload_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members read workload" ON public.workload_snapshots;
CREATE POLICY "Org members read workload" ON public.workload_snapshots FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.organization_members
        WHERE org_id = workload_snapshots.org_id AND user_id = auth.uid()));

-- =============================================================================
-- PHASE 7 — GitHub integration
-- =============================================================================

UPDATE public.plans
SET features = features || '{"github_integration":false,"extended_api":false}'::jsonb
WHERE id IN ('free', 'pro', 'business');
UPDATE public.plans
SET features = features || '{"github_integration":true,"extended_api":true}'::jsonb
WHERE id IN ('pro', 'business');

CREATE TABLE IF NOT EXISTS public.github_connections (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    repos        TEXT[] NOT NULL DEFAULT '{}',
    connected_by UUID NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org admins manage github" ON public.github_connections;
CREATE POLICY "Org admins manage github" ON public.github_connections FOR ALL
    USING (EXISTS (SELECT 1 FROM public.organization_members
        WHERE org_id = github_connections.org_id AND user_id = auth.uid() AND role IN ('admin','owner')));

CREATE TABLE IF NOT EXISTS public.task_github_links (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    link_type   TEXT NOT NULL,
    repo        TEXT NOT NULL,
    number      INT,
    url         TEXT NOT NULL,
    title       TEXT,
    state       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS task_github_links_task_idx ON public.task_github_links (task_id);
ALTER TABLE public.task_github_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members manage github links" ON public.task_github_links;
CREATE POLICY "Org members manage github links" ON public.task_github_links FOR ALL
    USING (EXISTS (SELECT 1 FROM public.organization_members
        WHERE org_id = task_github_links.org_id AND user_id = auth.uid()));

-- =============================================================================
-- ADMIN TIER 2 — broadcasts + coupons
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.broadcasts (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title          TEXT NOT NULL,
    body           TEXT NOT NULL,
    target_filter  JSONB NOT NULL DEFAULT '{}',
    channels       TEXT[] NOT NULL DEFAULT '{in_app}',
    scheduled_for  TIMESTAMPTZ,
    sent_at        TIMESTAMPTZ,
    created_by     UUID NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS broadcasts_created_idx ON public.broadcasts (created_at DESC);
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins manage broadcasts" ON public.broadcasts;
CREATE POLICY "Platform admins manage broadcasts"
    ON public.broadcasts FOR ALL USING (public.is_platform_admin());

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
CREATE INDEX IF NOT EXISTS broadcast_deliveries_broadcast_idx ON public.broadcast_deliveries (broadcast_id);
ALTER TABLE public.broadcast_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own deliveries" ON public.broadcast_deliveries;
CREATE POLICY "Users read own deliveries" ON public.broadcast_deliveries FOR SELECT
    USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Platform admins manage deliveries" ON public.broadcast_deliveries;
CREATE POLICY "Platform admins manage deliveries" ON public.broadcast_deliveries FOR ALL
    USING (public.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.coupons (
    code              TEXT PRIMARY KEY,
    stripe_coupon_id  TEXT,
    percent_off       INT,
    amount_off_cents  INT,
    currency          TEXT NOT NULL DEFAULT 'USD',
    valid_until       TIMESTAMPTZ,
    max_redemptions   INT,
    redemptions       INT NOT NULL DEFAULT 0,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_by        UUID NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins manage coupons" ON public.coupons;
CREATE POLICY "Platform admins manage coupons" ON public.coupons FOR ALL
    USING (public.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_code TEXT NOT NULL REFERENCES public.coupons(code) ON DELETE CASCADE,
    org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (coupon_code, org_id)
);
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins manage redemptions" ON public.coupon_redemptions;
CREATE POLICY "Platform admins manage redemptions" ON public.coupon_redemptions FOR ALL
    USING (public.is_platform_admin());

-- =============================================================================
-- ADMIN TIER 3 — GDPR + support tickets
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gdpr_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    user_id       UUID NOT NULL,
    type          TEXT NOT NULL CHECK (type IN ('export', 'anonymize')),
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    notes         TEXT,
    file_url      TEXT,
    requested_by  UUID NOT NULL,
    requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS gdpr_requests_user_idx ON public.gdpr_requests (user_id, requested_at DESC);
ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins manage gdpr requests" ON public.gdpr_requests;
CREATE POLICY "Platform admins manage gdpr requests" ON public.gdpr_requests FOR ALL
    USING (public.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    opened_by   UUID NOT NULL,
    subject     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority    TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    assigned_to UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON public.support_tickets (status, priority, created_at DESC);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins manage support tickets" ON public.support_tickets;
CREATE POLICY "Platform admins manage support tickets" ON public.support_tickets FOR ALL
    USING (public.is_platform_admin());

CREATE TABLE IF NOT EXISTS public.support_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL,
    body        TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON public.support_messages (ticket_id, created_at);
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins manage support messages" ON public.support_messages;
CREATE POLICY "Platform admins manage support messages" ON public.support_messages FOR ALL
    USING (public.is_platform_admin());

COMMIT;

-- ==============================================================================
-- DONE.
-- After running this, the dashboard should load without column errors,
-- broadcasts should deliver to all org members, and every gated feature
-- (comments, milestones, sprints, github, etc.) is unblocked from the schema side.
-- Feature flags on individual plans still control who SEES each feature in UI.
-- ==============================================================================
