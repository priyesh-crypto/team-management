-- ==========================================
-- Workload Heatmap View (Refined for Accuracy)
-- Purpose: Aggregates hours from subtasks on logged dates, 
-- and task counts/urgency from active tasks for capacity planning.
-- ==========================================

DROP VIEW IF EXISTS public.workload_heatmap;

CREATE OR REPLACE VIEW public.workload_heatmap AS
WITH RECURSIVE days AS (
    SELECT generate_series(
        date_trunc('week', now())::date,
        (date_trunc('week', now()) + interval '6 days')::date,
        interval '1 day'
    )::date AS day
),
daily_hours AS (
    -- Aggregates hours from subtasks based on when they were actually logged
    SELECT 
        s.employee_id,
        s.date_logged,
        t.org_id,
        SUM(COALESCE(s.hours_spent, 0)) as total_hours,
        COUNT(DISTINCT t.id) as historical_task_count
    FROM public.subtasks s
    JOIN public.tasks t ON s.task_id = t.id
    GROUP BY s.employee_id, s.date_logged, t.org_id
),
active_load AS (
    -- Aggregates task count and urgency based on tasks active during each day
    -- A task is active if the day falls between start_date and deadline
    SELECT 
        p.id as employee_id,
        d.day,
        om.org_id,
        COUNT(t.id) as scheduled_task_count,
        SUM(
            CASE t.priority
              WHEN 'Urgent' THEN 4
              WHEN 'High'   THEN 2
              WHEN 'Medium' THEN 1
              ELSE 0
            END
            + CASE WHEN t.deadline < d.day AND t.status != 'Completed' THEN 3 ELSE 0 END
        ) AS urgency_score
    FROM public.profiles p
    JOIN public.organization_members om ON om.user_id = p.id
    CROSS JOIN days d
    LEFT JOIN public.tasks t ON (
        t.employee_id = p.id 
        AND d.day >= t.start_date::date 
        AND d.day <= t.deadline::date
        AND t.status != 'Completed'
        AND t.org_id = om.org_id
    )
    GROUP BY p.id, d.day, om.org_id
)
SELECT
  p.id           AS user_id,
  p.name         AS full_name,
  d.day          AS day,
  CASE 
    WHEN d.day < CURRENT_DATE THEN COALESCE(dh.historical_task_count, 0)
    ELSE COALESCE(al.scheduled_task_count, 0)
  END AS task_count,
  COALESCE(dh.total_hours, 0) AS hours_logged,
  CASE 
    WHEN d.day < CURRENT_DATE THEN CASE WHEN COALESCE(dh.total_hours, 0) > 0 THEN 1 ELSE 0 END
    ELSE COALESCE(al.urgency_score, 0)
  END AS urgency_score,
  om.org_id
FROM public.profiles p
JOIN public.organization_members om ON om.user_id = p.id
CROSS JOIN days d
LEFT JOIN daily_hours dh ON dh.employee_id = p.id AND dh.date_logged = d.day AND dh.org_id = om.org_id
LEFT JOIN active_load al ON al.employee_id = p.id AND al.day = d.day AND al.org_id = om.org_id
ORDER BY p.name, d.day;

ALTER VIEW public.workload_heatmap SET (security_invoker = on);
