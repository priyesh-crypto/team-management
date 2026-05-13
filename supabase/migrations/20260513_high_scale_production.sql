-- ─────────────────────────────────────────────────────────────────────────────
-- High-Scale Production Migration
-- Target: 10,000 concurrent users
-- Adds: composite indexes, GIN arrays, materialized workload view,
--       pg_cron refresh, get_member_profiles RPC, session-var RLS helper
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Phase 1: Composite Indexes ────────────────────────────────────────────────

-- Most common dashboard query: filter org + status, sort by dates
CREATE INDEX IF NOT EXISTS idx_tasks_org_status_dates
    ON public.tasks (org_id, status, start_date, deadline);

-- Workload / assignment queries (manager view, workload heatmap)
CREATE INDEX IF NOT EXISTS idx_tasks_org_perf
    ON public.tasks (org_id, employee_id, status);

-- GIN index so "assignee_ids @> ARRAY[userId]" is O(log N) instead of O(N)
CREATE INDEX IF NOT EXISTS idx_tasks_assignees_gin
    ON public.tasks USING GIN (assignee_ids);

-- Subtask date-range scans (workload heatmap, today's logs)
CREATE INDEX IF NOT EXISTS idx_subtasks_date_org
    ON public.subtasks (org_id, date_logged, employee_id);

-- Notification reads per user (unread badge count)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications (user_id, is_read, created_at DESC);

-- Activity feed chronological scan per org
CREATE INDEX IF NOT EXISTS idx_activity_logs_org_created
    ON public.activity_logs (org_id, created_at DESC);

-- ── Phase 2: Materialized Workload Summary ────────────────────────────────────
-- Stores pre-aggregated hours/subtask count per (employee, org, day).
-- Real-time heatmap queries JOIN against this instead of scanning subtasks.

CREATE MATERIALIZED VIEW IF NOT EXISTS public.workload_summary AS
SELECT
    s.employee_id,
    s.org_id,
    s.date_logged,
    COUNT(*)                    AS subtask_count,
    COUNT(DISTINCT s.task_id)   AS task_count,
    SUM(s.hours_spent)          AS total_hours
FROM public.subtasks s
WHERE s.date_logged >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY s.employee_id, s.org_id, s.date_logged;

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_workload_summary_pk
    ON public.workload_summary (employee_id, org_id, date_logged);

-- ── Phase 3: pg_cron Refresh ──────────────────────────────────────────────────
-- Requires: Supabase Dashboard → Database → Extensions → enable pg_cron
-- Schedule the materialized view to refresh every 5 minutes.
-- The ON CONFLICT DO NOTHING makes this migration idempotent.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        PERFORM cron.schedule(
            'refresh-workload-summary',
            '*/5 * * * *',
            $cmd$REFRESH MATERIALIZED VIEW CONCURRENTLY public.workload_summary$cmd$
        );
    END IF;
END;
$$;

-- ── Phase 4: get_member_profiles RPC ─────────────────────────────────────────
-- Single SQL JOIN replaces two round-trips + O(N×M) Node.js mapping.
-- Called from getProfiles() in actions.ts.
-- Ensure email column exists in profiles (performance optimization)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Backfill emails from auth.users if missing
DO $$
BEGIN
    UPDATE public.profiles p
    SET email = u.email
    FROM auth.users u
    WHERE p.id = u.id AND p.email IS NULL;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not backfill emails (likely missing permissions on auth schema).';
END;
$$;

CREATE OR REPLACE FUNCTION public.get_member_profiles(
    p_org_id     UUID,
    p_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id         UUID,
    name       TEXT,
    email      TEXT,
    role       TEXT,
    avatar_url TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        p.id,
        COALESCE(p.name,  'Team Member') AS name,
        COALESCE(p.email, '')            AS email,
        COALESCE(p.role::text, m.member_role, 'employee') AS role,
        p.avatar_url
    FROM (
        -- org-wide members (used when no project scoping)
        SELECT user_id, role::text AS member_role
        FROM   organization_members
        WHERE  org_id = p_org_id
          AND  p_project_id IS NULL

        UNION ALL

        -- project-scoped members
        SELECT user_id, role::text AS member_role
        FROM   project_members
        WHERE  project_id = p_project_id
          AND  p_project_id IS NOT NULL
    ) m
    JOIN profiles p ON p.id = m.user_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_member_profiles(UUID, UUID) TO authenticated;

-- ── Phase 5: Session-Variable RLS Helper ─────────────────────────────────────
-- Call set_current_org(orgId) once per request in a Supabase Edge Function or
-- Server Action before issuing queries. RLS policies can then reference
-- current_setting('app.current_org_id', true) instead of running a subquery
-- for every row evaluated.
--
-- Example policy rewrite:
--   OLD: USING (org_id IN (SELECT org_id FROM organization_members WHERE user_id = auth.uid()))
--   NEW: USING (org_id::text = current_setting('app.current_org_id', true))

CREATE OR REPLACE FUNCTION public.set_current_org(p_org_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM set_config('app.current_org_id', p_org_id, true); -- true = transaction-scoped
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_current_org(TEXT) TO authenticated;
