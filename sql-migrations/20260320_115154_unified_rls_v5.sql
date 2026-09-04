-- ==========================================
-- UNIFIED RLS v5: Subtasks & Activity Logs
-- Purpose: Restore missing INSERT/UPDATE/DELETE policies for subtasks and activity_logs.
-- ==========================================

BEGIN;

-- 1. SUBTASKS Table Policies
DROP POLICY IF EXISTS "unified_v5_select_subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "unified_v5_insert_subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "unified_v5_update_subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "unified_v5_delete_subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Tenant Isolation: Insert Subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Tenant Isolation: Update Subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Tenant Isolation: Delete Subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "high_perf_select_subtasks" ON public.subtasks;

-- SELECT: Anyone in the org can see subtasks of tasks they can see
CREATE POLICY "unified_v5_select_subtasks" ON public.subtasks FOR SELECT
USING (
    org_id IN (SELECT org_id FROM public.get_auth_orgs())
);

-- INSERT: Anyone in the org can create subtasks
CREATE POLICY "unified_v5_insert_subtasks" ON public.subtasks FOR INSERT
WITH CHECK (
    org_id IN (SELECT org_id FROM public.get_auth_orgs())
);

-- UPDATE: Own subtasks OR managers
CREATE POLICY "unified_v5_update_subtasks" ON public.subtasks FOR UPDATE
USING (
    org_id IN (SELECT org_id FROM public.get_auth_orgs())
    AND (
        auth.uid() = employee_id
        OR public.is_org_manager(org_id)
    )
);

-- DELETE: Own subtasks OR managers
CREATE POLICY "unified_v5_delete_subtasks" ON public.subtasks FOR DELETE
USING (
    org_id IN (SELECT org_id FROM public.get_auth_orgs())
    AND (
        auth.uid() = employee_id
        OR public.is_org_manager(org_id)
    )
);


-- 2. ACTIVITY_LOGS Table Policies
DROP POLICY IF EXISTS "unified_v5_select_activity" ON public.activity_logs;
DROP POLICY IF EXISTS "unified_v5_insert_activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can view activity logs in their orgs" ON public.activity_logs;

CREATE POLICY "unified_v5_select_activity" ON public.activity_logs FOR SELECT
USING (
    org_id IN (SELECT org_id FROM public.get_auth_orgs())
);

CREATE POLICY "unified_v5_insert_activity" ON public.activity_logs FOR INSERT
WITH CHECK (
    org_id IN (SELECT org_id FROM public.get_auth_orgs())
);


-- 3. NOTIFICATIONS Table Policies (Ensure employees can insert notifications they trigger)
DROP POLICY IF EXISTS "unified_v5_insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "high_perf_manager_insert_notifications" ON public.notifications;

CREATE POLICY "unified_v5_insert_notifications" ON public.notifications FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE user_id = auth.uid()
    )
);

COMMIT;
