-- ==========================================
-- Performance Indexes for Large Tables
-- ==========================================

BEGIN;

-- Indexes for 'tasks' table
CREATE INDEX IF NOT EXISTS idx_tasks_org_id ON public.tasks (org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_employee_id ON public.tasks (employee_id);

-- Optional: GIN index for assignee_ids (better array search performance)
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_ids ON public.tasks USING GIN (assignee_ids);

-- Indexes for 'projects' table
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON public.projects (org_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects (status);

-- Indexes for 'comments' table
CREATE INDEX IF NOT EXISTS idx_comments_task_id ON public.comments (task_id);
CREATE INDEX IF NOT EXISTS idx_comments_org_id ON public.comments (org_id);

-- Indexes for 'attachments' table
CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON public.attachments (task_id);
CREATE INDEX IF NOT EXISTS idx_attachments_org_id ON public.attachments (org_id);

-- Indexes for 'activity_logs' (if not adequately indexed)
CREATE INDEX IF NOT EXISTS idx_activity_logs_task_id ON public.activity_logs (task_id);

COMMIT;
