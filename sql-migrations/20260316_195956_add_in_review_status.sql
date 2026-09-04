-- Migration: Add 'In Review' status to tasks table
-- This script updates the check constraint on the 'status' column.

DO $$
BEGIN
    -- DROP the existing constraint if it exists. 
    -- Since it wasn't named explicitly in supabase_setup.sql, 
    -- PostgreSQL likely named it 'tasks_status_check'.
    ALTER TABLE IF EXISTS public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
    
    -- Add the updated constraint
    ALTER TABLE public.tasks 
    ADD CONSTRAINT tasks_status_check 
    CHECK (status IN ('To Do', 'In Progress', 'In Review', 'Completed', 'Blocked'));
END $$;
