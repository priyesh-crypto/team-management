-- ==============================================================================
-- Phase 6: Milestones, Sprints & Workload view
-- Additive-only. Safe to re-run (idempotent).
-- ==============================================================================

BEGIN;

-- ── 1. Feature flags ──────────────────────────────────────────────────────────

UPDATE public.plans
SET features = features
    || '{"milestones":false,"sprints":false,"workload_view":false}'::jsonb
WHERE id IN ('free', 'pro', 'business');

UPDATE public.plans
SET features = features
    || '{"milestones":true,"sprints":true}'::jsonb
WHERE id = 'pro';

UPDATE public.plans
SET features = features
    || '{"milestones":true,"sprints":true,"workload_view":true}'::jsonb
WHERE id = 'business';

-- ── 2. Milestones ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.milestones (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL,
    name         TEXT NOT NULL,
    description  TEXT,
    due_date     DATE,
    status       TEXT NOT NULL DEFAULT 'active',  -- active | completed | cancelled
    color        TEXT NOT NULL DEFAULT '#0c64ef',
    created_by   UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can read milestones" ON public.milestones;
CREATE POLICY "Org members can read milestones" ON public.milestones FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = milestones.org_id AND user_id = auth.uid()
    ));
DROP POLICY IF EXISTS "Managers can manage milestones" ON public.milestones;
CREATE POLICY "Managers can manage milestones" ON public.milestones FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = milestones.org_id AND user_id = auth.uid()
          AND role IN ('manager','admin','owner')
    ));

-- Tasks can reference a milestone
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS milestone_id UUID REFERENCES public.milestones(id) ON DELETE SET NULL;

-- ── 3. Sprints ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.sprints (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL,
    name         TEXT NOT NULL,
    goal         TEXT,
    start_date   DATE NOT NULL,
    end_date     DATE NOT NULL,
    status       TEXT NOT NULL DEFAULT 'planning',  -- planning | active | completed
    created_by   UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Org members can read sprints" ON public.sprints;
CREATE POLICY "Org members can read sprints" ON public.sprints FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = sprints.org_id AND user_id = auth.uid()
    ));
DROP POLICY IF EXISTS "Managers can manage sprints" ON public.sprints;
CREATE POLICY "Managers can manage sprints" ON public.sprints FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = sprints.org_id AND user_id = auth.uid()
          AND role IN ('manager','admin','owner')
    ));

-- Tasks can belong to a sprint
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS sprint_id UUID REFERENCES public.sprints(id) ON DELETE SET NULL;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS story_points INT;

-- ── 4. Workload slots (pre-computed capacity snapshots) ───────────────────────
-- Updated by a trigger or cron; this just stores the view cache

CREATE TABLE IF NOT EXISTS public.workload_snapshots (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id     UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL,
    date       DATE NOT NULL,
    task_count INT NOT NULL DEFAULT 0,
    hours      NUMERIC(6,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, user_id, date)
);

ALTER TABLE public.workload_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers can read workload" ON public.workload_snapshots;
CREATE POLICY "Managers can read workload" ON public.workload_snapshots FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = workload_snapshots.org_id AND user_id = auth.uid()
          AND role IN ('manager','admin','owner')
    ));

COMMIT;
