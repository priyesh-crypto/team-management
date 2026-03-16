-- Fix: RLS policies for project_members
-- These were missing in the initial multi-project setup, 
-- causing visibility and insertion issues for both managers and employees.

-- 1. Selection: 
-- Managers can see all project memberships in the org.
-- Employees can see memberships for projects they are part of, or their own memberships.
DROP POLICY IF EXISTS "members_see_org_project_members" ON public.project_members;
CREATE POLICY "members_see_org_project_members"
  ON public.project_members FOR SELECT
  USING (
    -- Managers can see everything in their org
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
    OR
    -- Users can see their own memberships
    user_id = auth.uid()
    OR
    -- Users can see memberships of projects they belong to
    project_id IN (
      SELECT pm.project_id FROM public.project_members pm WHERE pm.user_id = auth.uid()
    )
  );

-- 2. Management: Managers can manage project memberships
-- Simplified to use the profile role check directly.
DROP POLICY IF EXISTS "managers_manage_project_members" ON public.project_members;
CREATE POLICY "managers_manage_project_members"
  ON public.project_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );
