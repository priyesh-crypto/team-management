-- ==========================================
-- FIX: Security Definer View Errors
-- This script converts views to SECURITY INVOKER
-- to comply with Supabase security best practices.
-- ==========================================

-- 1. Fix cross_project_tasks
DROP VIEW IF EXISTS public.cross_project_tasks;
CREATE OR REPLACE VIEW public.cross_project_tasks 
WITH (security_invoker = true)
AS
SELECT
  t.*,
  p.name        AS project_name,
  p.color       AS project_color,
  p.icon        AS project_icon,
  pr.name       AS assignee_name
FROM public.tasks t
LEFT JOIN public.projects p    ON p.id = t.project_id
LEFT JOIN public.profiles pr   ON pr.id = t.employee_id;

-- 2. Fix my_tasks_all_projects
DROP VIEW IF EXISTS public.my_tasks_all_projects;
CREATE OR REPLACE VIEW public.my_tasks_all_projects 
WITH (security_invoker = true)
AS
SELECT
  t.*,
  p.name   AS project_name,
  p.color  AS project_color,
  p.icon   AS project_icon
FROM public.tasks t
LEFT JOIN public.projects p ON p.id = t.project_id
WHERE
  t.employee_id = auth.uid()
  AND t.status NOT IN ('completed', 'cancelled');

-- Note: In Postgres 15+, security_invoker = true ensures the view 
-- respects the RLS policies of the user querying it.
