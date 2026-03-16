-- ==========================================
-- Workload Heatmap View (Refined)
-- Purpose: Aggregates tasks, hours, and urgency score per team member per day
-- ==========================================

DROP VIEW IF EXISTS public.workload_heatmap;

CREATE OR REPLACE VIEW public.workload_heatmap AS
SELECT
  p.id           AS user_id,
  p.name         AS full_name,
  d.day::date    AS day,
  COUNT(t.id)    AS task_count,
  SUM(COALESCE(t.hours_spent, 0)) AS hours_logged,
  -- Urgency score: Urgent=4, High=2, Medium=1, Low=0. Overdue (+3)
  SUM(
    CASE t.priority
      WHEN 'Urgent' THEN 4
      WHEN 'High'   THEN 2
      WHEN 'Medium' THEN 1
      ELSE 0
    END
    + CASE WHEN t.deadline < NOW() AND t.status != 'Completed' THEN 3 ELSE 0 END
  ) AS urgency_score,
  om.org_id
FROM public.profiles p
JOIN public.organization_members om ON om.user_id = p.id
CROSS JOIN LATERAL (
  SELECT generate_series(
    date_trunc('week', now())::date,
    (date_trunc('week', now()) + interval '6 days')::date,
    interval '1 day'
  )::date AS day
) d
LEFT JOIN public.tasks t 
  ON t.employee_id = p.id 
  AND t.deadline::date = d.day
  AND t.status != 'Completed'
  AND t.org_id = om.org_id
GROUP BY p.id, p.name, d.day, om.org_id
ORDER BY p.name, d.day;

ALTER VIEW public.workload_heatmap SET (security_invoker = on);
