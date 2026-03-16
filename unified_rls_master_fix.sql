-- ==========================================
-- UNIFIED RLS MASTER FIX
-- This script fixes recursion, visibility, and 
-- tenant isolation issues once and for all.
-- Run this in the Supabase SQL Editor.
-- ==========================================

BEGIN;

-- 1. Helper Functions (Non-Recursive)
CREATE OR REPLACE FUNCTION public.get_auth_orgs()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT org_id FROM public.organization_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_org_manager(org_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'manager'
  ) AND EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE org_id = org_id_param AND user_id = auth.uid()
  );
$$;

-- 2. Organization Members
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view members of their orgs" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Tenant Isolation: Select organization_members" ON public.organization_members;

CREATE POLICY "unified_select_org_members" 
  ON public.organization_members FOR SELECT 
  USING (org_id IN (SELECT public.get_auth_orgs()));

CREATE POLICY "unified_manage_org_members" 
  ON public.organization_members FOR ALL 
  USING (org_id IN (SELECT public.get_auth_orgs()) AND (SELECT public.is_org_manager(org_id)));

-- 3. Projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members_see_org_projects" ON public.projects;
DROP POLICY IF EXISTS "managers_manage_projects" ON public.projects;
DROP POLICY IF EXISTS "Tenant Isolation: Select projects" ON public.projects;

CREATE POLICY "unified_select_projects" 
  ON public.projects FOR SELECT 
  USING (org_id IN (SELECT public.get_auth_orgs()));

CREATE POLICY "unified_manage_projects" 
  ON public.projects FOR ALL 
  USING (org_id IN (SELECT public.get_auth_orgs()) AND (SELECT public.is_org_manager(org_id)));

-- 4. Project Members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members_see_org_project_members" ON public.project_members;
DROP POLICY IF EXISTS "managers_manage_project_members" ON public.project_members;

CREATE POLICY "unified_select_project_members" 
  ON public.project_members FOR SELECT 
  USING (project_id IN (SELECT id FROM public.projects WHERE org_id IN (SELECT public.get_auth_orgs())));

CREATE POLICY "unified_manage_project_members" 
  ON public.project_members FOR ALL 
  USING (project_id IN (SELECT id FROM public.projects WHERE org_id IN (SELECT public.get_auth_orgs()) AND (SELECT public.is_org_manager(org_id))));

-- 5. Tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation: Select Tasks" ON public.tasks;
DROP POLICY IF EXISTS "Tenant Isolation: Insert Tasks" ON public.tasks;
DROP POLICY IF EXISTS "Tenant Isolation: Update Tasks" ON public.tasks;
DROP POLICY IF EXISTS "Tenant Isolation: Delete Tasks" ON public.tasks;
DROP POLICY IF EXISTS "members_see_project_tasks" ON public.tasks;

-- Selective access for tasks based on assignment OR manager role OR project membership
CREATE POLICY "unified_select_tasks" 
  ON public.tasks FOR SELECT 
  USING (
    org_id IN (SELECT public.get_auth_orgs())
    AND (
      -- Managers see everything in their org
      (SELECT public.is_org_manager(org_id))
      OR
      -- Owners or Assignees see the task
      auth.uid() = employee_id
      OR
      (assignee_ids IS NOT NULL AND auth.uid() = ANY(assignee_ids))
      OR
      -- Project members see project tasks
      (project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.project_members WHERE project_id = tasks.project_id AND user_id = auth.uid()))
      OR
      -- Legacy tasks (no project) are visible to everyone in the org for now to prevent data loss
      project_id IS NULL
    )
  );

CREATE POLICY "unified_insert_tasks" 
  ON public.tasks FOR INSERT 
  WITH CHECK (org_id IN (SELECT public.get_auth_orgs()) AND (SELECT public.is_org_manager(org_id)));

CREATE POLICY "unified_update_tasks" 
  ON public.tasks FOR UPDATE 
  USING (org_id IN (SELECT public.get_auth_orgs()) AND ((SELECT public.is_org_manager(org_id)) OR auth.uid() = employee_id OR (assignee_ids IS NOT NULL AND auth.uid() = ANY(assignee_ids))));

CREATE POLICY "unified_delete_tasks" 
  ON public.tasks FOR DELETE 
  USING (org_id IN (SELECT public.get_auth_orgs()) AND ((SELECT public.is_org_manager(org_id)) OR auth.uid() = employee_id));

COMMIT;
