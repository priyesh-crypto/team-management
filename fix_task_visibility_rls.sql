-- Fix: Broaden Task RLS for Employees
-- Allows employees to see tasks they are assigned to or own, 
-- regardless of project membership status.

-- 1. Ensure Tenant Isolation is active but doesn't block project-specific logic
-- This policy allows everyone in the org to see all tasks (permissive).
-- If we want strict project isolation, we should instead refine the project policy.
-- The user reported "data is not visible", so let's make sure the project policy
-- includes the assignee/owner.

DROP POLICY IF EXISTS "members_see_project_tasks" ON public.tasks;
CREATE POLICY "members_see_project_tasks"
  ON public.tasks FOR SELECT
  USING (
    -- Legacy tasks
    project_id IS NULL   
    OR 
    -- User is the owner (employee_id)
    auth.uid() = employee_id
    OR
    -- User is a collaborator (assignee_ids array)
    (assignee_ids IS NOT NULL AND auth.uid() = ANY(assignee_ids))
    OR
    -- User is a member of the project
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.project_id = tasks.project_id
        AND pm.user_id = auth.uid()
    )
    OR
    -- Managers see everything in their org
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );
