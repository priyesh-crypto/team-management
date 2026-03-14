-- ==========================================
-- FIX EMPLOYEE TASK CREATION RLS
-- Purpose: Allow employees to create tasks and manage their own
-- ==========================================

BEGIN;

-- 1. Update Insert Policy
-- Existing policy might be named "Tenant Isolation: Insert Tasks"
DROP POLICY IF EXISTS "Tenant Isolation: Insert Tasks" ON public.tasks;

CREATE POLICY "Tenant Isolation: Insert Tasks" ON public.tasks 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE org_id = tasks.org_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'manager', 'employee')
    )
);

-- 2. Update Delete Policy
-- Existing policy might be named "Tenant Isolation: Delete Tasks"
DROP POLICY IF EXISTS "Tenant Isolation: Delete Tasks" ON public.tasks;

CREATE POLICY "Tenant Isolation: Delete Tasks" ON public.tasks 
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE org_id = tasks.org_id 
        AND user_id = auth.uid() 
        AND (
            role IN ('owner', 'admin', 'manager') 
            OR (role = 'employee' AND employee_id = auth.uid())
        )
    )
);

-- 3. Ensure Update Policy is inclusive (should be "Tenant Isolation: Update Tasks")
-- This policy usually uses USING (EXISTS (...)) which covers collaborator check or ownership
-- If it was restrictive, we should ensure it's correct.
-- Current policy in migration_multi_tenant.sql was:
-- CREATE POLICY "Tenant Isolation: Update Tasks" ON public.tasks FOR UPDATE USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = tasks.org_id AND user_id = auth.uid()));
-- This is already quite inclusive (any member of the org can update any task).

COMMIT;
