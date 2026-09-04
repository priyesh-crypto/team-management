-- ==========================================
-- UNIFIED RLS v2: Fix Visibility & Recursion
-- ==========================================

BEGIN;

-- 1. Helper Function: Check Project Membership (Security Definer)
-- This breaks the circular dependency between projects and project_members
CREATE OR REPLACE FUNCTION public.is_project_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members 
    WHERE project_id = p_project_id 
      AND user_id = p_user_id
  );
$$;

-- 2. PROJECTS Table Policies
DROP POLICY IF EXISTS "high_perf_select_projects" ON public.projects;
DROP POLICY IF EXISTS "high_perf_manage_projects" ON public.projects;
DROP POLICY IF EXISTS "managers_see_all_projects" ON public.projects;
DROP POLICY IF EXISTS "members_see_own_projects" ON public.projects;
DROP POLICY IF EXISTS "managers_manage_projects" ON public.projects;

-- Managers see all org projects; Employees see projects they belong to
CREATE POLICY "unified_v2_select_projects" ON public.projects FOR SELECT
USING (
    org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g)
    AND (
        public.is_org_manager(org_id)
        OR public.is_project_member(id, (SELECT auth.uid()))
    )
);

CREATE POLICY "unified_v2_manage_projects" ON public.projects FOR ALL
USING (
    org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g)
    AND public.is_org_manager(org_id)
);

-- 3. PROJECT_MEMBERS Table Policies
DROP POLICY IF EXISTS "high_perf_select_project_members" ON public.project_members;
DROP POLICY IF EXISTS "high_perf_manage_project_members" ON public.project_members;

-- Allow org members to see project memberships (necessary for UI/Profiles)
CREATE POLICY "unified_v2_select_members" ON public.project_members FOR SELECT
USING (
    project_id IN (
        SELECT p.id FROM public.projects p 
        WHERE p.org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g)
    )
);

-- Managers can manage all project memberships in their org
CREATE POLICY "unified_v2_manage_members" ON public.project_members FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_members.project_id
          AND public.is_org_manager(p.org_id)
    )
);

-- 4. TASKS Table Polishing
-- Ensure tasks are visible to project members even if not assigned
DROP POLICY IF EXISTS "high_perf_select_tasks" ON public.tasks;
CREATE POLICY "unified_v2_select_tasks" ON public.tasks FOR SELECT
USING (
    org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g)
    AND (
        public.is_org_manager(org_id)
        OR (SELECT auth.uid()) = employee_id
        OR (assignee_ids IS NOT NULL AND (SELECT auth.uid()) = ANY(assignee_ids))
        OR (project_id IS NOT NULL AND public.is_project_member(project_id, (SELECT auth.uid())))
        OR project_id IS NULL
    )
);

COMMIT;
