-- ==========================================
-- UNIFIED RLS v4: Definitive Fix
-- ==========================================

BEGIN;

-- 1. Redefine Core Helpers (Robust Syntax)
CREATE OR REPLACE FUNCTION public.get_auth_orgs()
RETURNS TABLE (org_id UUID) LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_org_manager(org_id_param UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE org_id = org_id_param 
      AND user_id = auth.uid() 
      AND role::text IN ('owner', 'admin', 'manager')
  );
$$;

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

-- 2. PROJECTS Table
-- Correcting syntax: using public.get_auth_orgs() without g.org_id alias if prone to error
DROP POLICY IF EXISTS "unified_v2_select_projects" ON public.projects;
DROP POLICY IF EXISTS "unified_v2_manage_projects" ON public.projects;

CREATE POLICY "unified_v4_select_projects" ON public.projects FOR SELECT
USING (
    org_id IN (SELECT org_id FROM public.get_auth_orgs())
    AND (
        public.is_org_manager(org_id)
        OR public.is_project_member(id, (SELECT auth.uid()))
    )
);

CREATE POLICY "unified_v4_manage_projects" ON public.projects FOR ALL
USING (
    org_id IN (SELECT org_id FROM public.get_auth_orgs())
    AND public.is_org_manager(org_id)
);

-- 3. PROJECT_MEMBERS Table
DROP POLICY IF EXISTS "unified_v2_select_members" ON public.project_members;
DROP POLICY IF EXISTS "unified_v2_manage_members" ON public.project_members;

CREATE POLICY "unified_v4_select_members" ON public.project_members FOR SELECT
USING (
    project_id IN (
        SELECT p.id FROM public.projects p 
        WHERE p.org_id IN (SELECT org_id FROM public.get_auth_orgs())
    )
);

CREATE POLICY "unified_v4_manage_members" ON public.project_members FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_members.project_id
          AND public.is_org_manager(p.org_id)
    )
);

-- 4. TASKS Table
DROP POLICY IF EXISTS "unified_v2_select_tasks" ON public.tasks;
DROP POLICY IF EXISTS "unified_v3_insert_tasks" ON public.tasks;
DROP POLICY IF EXISTS "unified_v3_update_tasks" ON public.tasks;

CREATE POLICY "unified_v4_select_tasks" ON public.tasks FOR SELECT
USING (
    org_id IN (SELECT org_id FROM public.get_auth_orgs())
    AND (
        public.is_org_manager(org_id)
        OR (SELECT auth.uid()) = employee_id
        OR (assignee_ids IS NOT NULL AND (SELECT auth.uid()) = ANY(assignee_ids))
        OR (project_id IS NOT NULL AND public.is_project_member(project_id, (SELECT auth.uid())))
        OR project_id IS NULL
    )
);

CREATE POLICY "unified_v4_insert_tasks" ON public.tasks FOR INSERT 
WITH CHECK (
    org_id IN (SELECT org_id FROM public.get_auth_orgs())
    AND (
        public.is_org_manager(org_id) 
        OR project_id IS NULL 
        OR public.is_project_member(project_id, (SELECT auth.uid()))
    )
);

CREATE POLICY "unified_v4_update_tasks" ON public.tasks FOR UPDATE 
USING (
    org_id IN (SELECT org_id FROM public.get_auth_orgs()) 
    AND (
        public.is_org_manager(org_id) 
        OR (SELECT auth.uid()) = employee_id 
        OR (assignee_ids IS NOT NULL AND (SELECT auth.uid()) = ANY(assignee_ids))
        OR (project_id IS NOT NULL AND public.is_project_member(project_id, (SELECT auth.uid())))
    )
);

CREATE POLICY "unified_v4_delete_tasks" ON public.tasks FOR DELETE 
USING (
    org_id IN (SELECT org_id FROM public.get_auth_orgs()) 
    AND (public.is_org_manager(org_id) OR (SELECT auth.uid()) = employee_id)
);

COMMIT;
