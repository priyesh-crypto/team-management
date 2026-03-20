-- Index for Workload Heatmap Detail View
CREATE INDEX IF NOT EXISTS idx_subtasks_employee_date_org ON public.subtasks (employee_id, date_logged, org_id) WHERE hours_spent > 0;

-- Optional: Index for general workload heatmap queries if it's a table
CREATE INDEX IF NOT EXISTS idx_subtasks_org_date ON public.subtasks (org_id, date_logged);
