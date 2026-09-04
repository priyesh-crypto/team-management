-- ==========================================
-- UNIFIED RLS v3: Enable Employee Task Creation
-- ==========================================

BEGIN;

-- Ensure helper functions exist
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

-- 1. Redefine TASKS Insert Policy
DROP POLICY IF EXISTS "high_perf_insert_tasks" ON public.tasks;
DROP POLICY IF EXISTS "recovery_insert_tasks" ON public.tasks;

CREATE POLICY "unified_v3_insert_tasks" 
    ON public.tasks FOR INSERT 
    WITH CHECK (
        org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g)
        AND (
            public.is_org_manager(org_id) 
            OR project_id IS NULL                     -- General org tasks
            OR public.is_project_member(project_id, (SELECT auth.uid())) -- Project tasks if member
        )
    );

-- 2. Redefine TASKS Update Policy (ensure it accounts for project membership too)
DROP POLICY IF EXISTS "high_perf_update_tasks" ON public.tasks;
DROP POLICY IF EXISTS "recovery_update_tasks" ON public.tasks;

CREATE POLICY "unified_v3_update_tasks" 
    ON public.tasks FOR UPDATE 
    USING (
        org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g) 
        AND (
            public.is_org_manager(org_id) 
            OR (SELECT auth.uid()) = employee_id 
            OR (assignee_ids IS NOT NULL AND (SELECT auth.uid()) = ANY(assignee_ids))
            OR (project_id IS NOT NULL AND public.is_project_member(project_id, (SELECT auth.uid())))
        )
    );

COMMIT;
