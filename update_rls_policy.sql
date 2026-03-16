-- ==============================================================================
-- MIGRATION: FIX TASK INSERTION RLS
-- Purpose: Allow users with 'employee' role to insert tasks in their organization.
-- ==============================================================================

BEGIN;

-- Drop the existing insertion policy
DROP POLICY IF EXISTS "Tenant Isolation: Insert Tasks" ON public.tasks;

-- Create the updated insertion policy including 'employee'
CREATE POLICY "Tenant Isolation: Insert Tasks" ON public.tasks 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE org_id = tasks.org_id 
        AND user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'manager', 'employee')
    )
);

COMMIT;
