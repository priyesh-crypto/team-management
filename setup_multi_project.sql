-- Phase 1: Multi-Project Organization Structure

-- 1. Create Projects Table
CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#0071e3',   -- Apple-style blue
  icon        TEXT DEFAULT '📁',
  status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Project Membership Table
CREATE TABLE IF NOT EXISTS public.project_members (
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('lead', 'member', 'viewer')),
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (project_id, user_id)
);

-- 3. Migrate Tasks Table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL;

-- 4. Create Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_project ON public.tasks (project_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON public.project_members (user_id);

-- 5. Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for Projects
DROP POLICY IF EXISTS "managers_see_all_projects" ON public.projects;
CREATE POLICY "managers_see_all_projects"
  ON public.projects FOR SELECT
  USING (
    org_id IN (SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'manager')
  );

DROP POLICY IF EXISTS "members_see_own_projects" ON public.projects;
CREATE POLICY "members_see_own_projects"
  ON public.projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_members
      WHERE project_id = projects.id
        AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "managers_manage_projects" ON public.projects;
CREATE POLICY "managers_manage_projects"
  ON public.projects FOR ALL
  USING (
    org_id IN (SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'manager')
  );

-- 7. RLS Policy for Tasks (Project-Aware)
DROP POLICY IF EXISTS "members_see_project_tasks" ON public.tasks;
CREATE POLICY "members_see_project_tasks"
  ON public.tasks FOR SELECT
  USING (
    project_id IS NULL   -- Allow legacy tasks
    OR EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = tasks.project_id
        AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- 8. Views for Aggregation
CREATE OR REPLACE VIEW public.cross_project_tasks AS
SELECT
  t.*,
  p.name        AS project_name,
  p.color       AS project_color,
  p.icon        AS project_icon,
  pr.name       AS assignee_name
FROM public.tasks t
LEFT JOIN public.projects p    ON p.id = t.project_id
LEFT JOIN public.profiles pr   ON pr.id = t.employee_id
WHERE
  (t.project_id IS NULL OR p.org_id IN (
    SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid()
  ));

CREATE OR REPLACE VIEW public.my_tasks_all_projects AS
SELECT
  t.*,
  p.name   AS project_name,
  p.color  AS project_color,
  p.icon   AS project_icon
FROM public.tasks t
LEFT JOIN public.projects p ON p.id = t.project_id
WHERE
  t.employee_id = auth.uid()
  AND t.status NOT IN ('completed', 'cancelled');

-- 9. Backfill: Create a default "General" project per org if none exist
-- This ensures existing tasks have a home if you choose to assign them.
INSERT INTO public.projects (org_id, name, color, icon)
SELECT DISTINCT org_id, 'General Workspace', '#86868b', '📋'
FROM public.tasks
WHERE project_id IS NULL AND org_id IS NOT NULL
ON CONFLICT DO NOTHING;
