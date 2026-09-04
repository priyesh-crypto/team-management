-- ==========================================
-- MIGRATION: SUBTASK DETAILS
-- Purpose: Add missing columns for daily work logs and precise duration tracking.
-- ==========================================

BEGIN;

-- 1. Add missing columns to public.subtasks
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS end_time TEXT;
ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS date_logged DATE DEFAULT CURRENT_DATE;

-- 2. Backfill existing subtasks with task owners (if any)
UPDATE public.subtasks 
SET employee_id = (SELECT employee_id FROM public.tasks WHERE id = task_id)
WHERE employee_id IS NULL;

-- 3. Update RLS policies to handle subtask isolation and creation
-- First, drop old policies if they exist (Migration 4 drop loop should have handled this, but being explicit is safer)
DROP POLICY IF EXISTS "Tenant Isolation: Insert Subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Tenant Isolation: Update Subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Tenant Isolation: Delete Subtasks" ON public.subtasks;

-- Allow employees to create subtasks for tasks in their org
CREATE POLICY "Tenant Isolation: Insert Subtasks" 
ON public.subtasks 
FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE org_id = subtasks.org_id 
        AND user_id = auth.uid()
    )
);

-- Allow employees to update their own subtasks OR if they are managers/owners
CREATE POLICY "Tenant Isolation: Update Subtasks" 
ON public.subtasks 
FOR UPDATE 
USING (
    auth.uid() = employee_id OR 
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE org_id = subtasks.org_id 
        AND user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'manager')
    )
);

-- Allow employees to delete their own subtasks OR if they are managers/owners
CREATE POLICY "Tenant Isolation: Delete Subtasks" 
ON public.subtasks 
FOR DELETE 
USING (
    auth.uid() = employee_id OR 
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE org_id = subtasks.org_id 
        AND user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'manager')
    )
);

COMMIT;
