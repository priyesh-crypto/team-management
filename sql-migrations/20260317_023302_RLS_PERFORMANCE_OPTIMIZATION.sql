-- ==============================================================================
-- RLS PERFORMANCE & SECURITY POLISH
-- Resolves "Auth RLS Initialization Plan" and "Multiple Permissive Policies"
-- ==============================================================================

BEGIN;

-- 1. Helper Function Optimization (Adding SELECT wrapper inside policies)
-- The linter recommends (SELECT auth.uid()) to allow Postgres to cache the result.

-- 2. PROFILES Optimization
DROP POLICY IF EXISTS "recovery_select_profiles" ON public.profiles;
DROP POLICY IF EXISTS "recovery_update_own_profile" ON public.profiles;

CREATE POLICY "optimized_select_profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "optimized_update_own_profile" ON public.profiles FOR UPDATE USING ((SELECT auth.uid()) = id);

-- 3. ORGANIZATION MEMBERS Optimization (Consolidate multiple policies)
DROP POLICY IF EXISTS "recovery_select_org_members" ON public.organization_members;
DROP POLICY IF EXISTS "recovery_manage_org_members" ON public.organization_members;
DROP POLICY IF EXISTS "unified_select_org_members" ON public.organization_members;
DROP POLICY IF EXISTS "unified_manage_org_members" ON public.organization_members;

CREATE POLICY "high_perf_management_org_members" 
    ON public.organization_members FOR ALL 
    USING (
        org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g)
    );

-- 4. PROJECTS Optimization
DROP POLICY IF EXISTS "recovery_select_projects" ON public.projects;
DROP POLICY IF EXISTS "recovery_manage_projects" ON public.projects;

CREATE POLICY "high_perf_select_projects" 
    ON public.projects FOR SELECT 
    USING (org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g));

CREATE POLICY "high_perf_manage_projects" 
    ON public.projects FOR ALL 
    USING (org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g) AND public.is_org_manager(org_id));

-- 5. PROJECT MEMBERS Optimization
DROP POLICY IF EXISTS "recovery_select_project_members" ON public.project_members;
DROP POLICY IF EXISTS "recovery_manage_project_members" ON public.project_members;

CREATE POLICY "high_perf_select_project_members" 
    ON public.project_members FOR SELECT 
    USING (project_id IN (SELECT p.id FROM public.projects p WHERE p.org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g)));

CREATE POLICY "high_perf_manage_project_members" 
    ON public.project_members FOR ALL 
    USING (project_id IN (SELECT p.id FROM public.projects p WHERE public.is_org_manager(p.org_id)));

-- 6. TASKS Optimization (Crucial Performance Fix)
DROP POLICY IF EXISTS "recovery_select_tasks" ON public.tasks;
DROP POLICY IF EXISTS "recovery_insert_tasks" ON public.tasks;
DROP POLICY IF EXISTS "recovery_update_tasks" ON public.tasks;
DROP POLICY IF EXISTS "recovery_delete_tasks" ON public.tasks;

CREATE POLICY "high_perf_select_tasks" 
    ON public.tasks FOR SELECT 
    USING (
        org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g)
        AND (
            public.is_org_manager(org_id)
            OR (SELECT auth.uid()) = employee_id
            OR (assignee_ids IS NOT NULL AND (SELECT auth.uid()) = ANY(assignee_ids))
            OR project_id IS NULL
        )
    );

CREATE POLICY "high_perf_insert_tasks" 
    ON public.tasks FOR INSERT 
    WITH CHECK (org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g) AND public.is_org_manager(org_id));

CREATE POLICY "high_perf_update_tasks" 
    ON public.tasks FOR UPDATE 
    USING (
        org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g) 
        AND (public.is_org_manager(org_id) OR (SELECT auth.uid()) = employee_id OR (assignee_ids IS NOT NULL AND (SELECT auth.uid()) = ANY(assignee_ids)))
    );

CREATE POLICY "high_perf_delete_tasks" 
    ON public.tasks FOR DELETE 
    USING (org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g) AND (public.is_org_manager(org_id) OR (SELECT auth.uid()) = employee_id));

-- 7. AUDIT LOGS Cleanup (Fix multiple permissive policies)
DROP POLICY IF EXISTS "employees_read_own_audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "managers_read_all_audit_logs" ON public.audit_logs;

CREATE POLICY "high_perf_read_audit_logs"
    ON public.audit_logs FOR SELECT
    USING (
        org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g)
        AND (
            public.is_org_manager(org_id)
            OR (SELECT auth.uid()) = actor_id
        )
    );

-- 8. COMMENTS Cleanup
DROP POLICY IF EXISTS "Users can view comments on their tasks" ON public.comments;
DROP POLICY IF EXISTS "Comments are viewable by everyone." ON public.comments;
DROP POLICY IF EXISTS "Anyone with access to the task can insert a comment." ON public.comments;
DROP POLICY IF EXISTS "Users can insert comments on their tasks" ON public.comments;
DROP POLICY IF EXISTS "Authors can delete their own comments." ON public.comments;

CREATE POLICY "high_perf_select_comments"
    ON public.comments FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id)); -- Respects task RLS

CREATE POLICY "high_perf_insert_comments"
    ON public.comments FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id));

CREATE POLICY "high_perf_delete_comments"
    ON public.comments FOR DELETE
    USING ((SELECT auth.uid()) = author_id);

-- 9. NOTIFICATIONS Cleanup
DROP POLICY IF EXISTS "Users can manage their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Managers can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Managers can insert notifications for anyone." ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications." ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications (mark as read)." ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications." ON public.notifications;

CREATE POLICY "high_perf_manage_own_notifications"
    ON public.notifications FOR ALL
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "high_perf_manager_insert_notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members om WHERE om.user_id = (SELECT auth.uid()) AND om.role::text IN ('owner', 'admin', 'manager')));

-- 10. SUBTASKS / ATTACHMENTS Optimization
DROP POLICY IF EXISTS "Tenant Isolation: Select Subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Tenant Isolation: Insert Subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Tenant Isolation: Update Subtasks" ON public.subtasks;
DROP POLICY IF EXISTS "Tenant Isolation: Delete Subtasks" ON public.subtasks;
CREATE POLICY "high_perf_select_subtasks" ON public.subtasks FOR SELECT USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id));

DROP POLICY IF EXISTS "Tenant Isolation: View Attachments" ON public.attachments;
DROP POLICY IF EXISTS "Tenant Isolation: Insert Attachments" ON public.attachments;
DROP POLICY IF EXISTS "Tenant Isolation: Delete Attachments" ON public.attachments;
CREATE POLICY "high_perf_view_attachments" ON public.attachments FOR SELECT USING (EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = task_id));

-- 11. INVITATIONS Optimization
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.invitations;
DROP POLICY IF EXISTS "Users can view their org invitations" ON public.invitations;
CREATE POLICY "high_perf_manage_invitations" ON public.invitations FOR ALL USING (org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g));

-- 12. WORKSPACES Optimization
DROP POLICY IF EXISTS "Admins can manage workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can view workspaces in their orgs" ON public.workspaces;
CREATE POLICY "high_perf_manage_workspaces" ON public.workspaces FOR ALL USING (org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g));

-- 13. DIGEST PREFERENCES Optimization
DROP POLICY IF EXISTS "Users can manage their own digest preferences" ON public.digest_preferences;
CREATE POLICY "high_perf_manage_digest_prefs" ON public.digest_preferences FOR ALL USING ((SELECT auth.uid()) = user_id);

COMMIT;
