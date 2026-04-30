-- ==============================================================================
-- Phase 5: Notifications & Collaboration — in-app inbox, comments, reactions
-- Additive-only. Safe to re-run (idempotent).
-- ==============================================================================

BEGIN;

-- ── 1. Feature flags ──────────────────────────────────────────────────────────

UPDATE public.plans
SET features = features
    || '{"notifications":false,"task_comments":false,"comment_reactions":false}'::jsonb
WHERE id IN ('free', 'pro', 'business');

UPDATE public.plans
SET features = features
    || '{"notifications":true,"task_comments":true,"comment_reactions":true}'::jsonb
WHERE id IN ('pro', 'business');

-- ── 2. In-app notifications ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL,
    type          TEXT NOT NULL,
    title         TEXT NOT NULL,
    body          TEXT,
    resource_type TEXT,
    resource_id   UUID,
    actor_id      UUID,
    actor_email   TEXT,
    read_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Guard columns in case the table already existed from a partial run
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body          TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS resource_type TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS resource_id   UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id      UUID;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_email   TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at       TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, read_at, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;
CREATE POLICY "Users can manage own notifications" ON public.notifications FOR ALL
    USING (user_id = auth.uid());

-- ── 3. Notification preferences ──────────────────────────────────────────────

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

-- ── 4. Task comments ─────────────────────────────────────────────────────────

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
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = task_comments.org_id AND user_id = auth.uid()
    ));
DROP POLICY IF EXISTS "Org members can create comments" ON public.task_comments;
CREATE POLICY "Org members can create comments" ON public.task_comments FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = task_comments.org_id AND user_id = auth.uid()
    ));
DROP POLICY IF EXISTS "Comment authors can edit own" ON public.task_comments;
CREATE POLICY "Comment authors can edit own" ON public.task_comments FOR UPDATE
    USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Comment authors and admins can delete" ON public.task_comments;
CREATE POLICY "Comment authors and admins can delete" ON public.task_comments FOR DELETE
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = task_comments.org_id AND user_id = auth.uid() AND role IN ('admin','owner')
    ));

-- ── 5. Comment reactions ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.comment_reactions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES public.task_comments(id) ON DELETE CASCADE,
    org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL,
    emoji      TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add unique constraint idempotently
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'comment_reactions_comment_id_user_id_emoji_key'
    ) THEN
        ALTER TABLE public.comment_reactions
            ADD CONSTRAINT comment_reactions_comment_id_user_id_emoji_key
            UNIQUE (comment_id, user_id, emoji);
    END IF;
END$$;

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can manage reactions" ON public.comment_reactions;
CREATE POLICY "Org members can manage reactions" ON public.comment_reactions FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = comment_reactions.org_id AND user_id = auth.uid()
    ));

COMMIT;
