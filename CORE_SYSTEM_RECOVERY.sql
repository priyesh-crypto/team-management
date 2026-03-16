-- ==============================================================================
-- CORE SYSTEM RECOVERY: Unified RLS & Visibility Fix
-- Purpose: Resolves ALL visibility issues and fixes recursion/syntax errors.
-- Instructions: 
-- 1. Open a NEW Query Tab in Supabase SQL Editor.
-- 2. Paste this ENTIRE script.
-- 3. Click RUN.
-- ==============================================================================

BEGIN;

-- 1. Recovery: Clear all existing conflicting policies on main tables
DO $$
DECLARE
    t text;
    pol record;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('tasks', 'projects', 'profiles', 'organization_members', 'project_members')
    LOOP
        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = t AND schemaname = 'public'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
        END LOOP;
    END LOOP;
END $$;

-- 2. Helper Functions (Security Definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.get_auth_orgs()
RETURNS TABLE (org_id UUID)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT om.org_id FROM public.organization_members om WHERE om.user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_org_manager(org_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE org_id = org_id_param 
      AND user_id = auth.uid() 
      AND role::text IN ('owner', 'admin', 'manager')
  );
$$;

-- 3. Profiles (Always visible for lookups)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recovery_select_profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "recovery_update_own_profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 4. Organization Members (Tenant Isolation)
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recovery_select_org_members" 
    ON public.organization_members FOR SELECT 
    USING (org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g));

CREATE POLICY "recovery_manage_org_members" 
    ON public.organization_members FOR ALL 
    USING (public.is_org_manager(org_id));

-- 5. Projects (Org-wide visibility)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recovery_select_projects" 
    ON public.projects FOR SELECT 
    USING (org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g));

CREATE POLICY "recovery_manage_projects" 
    ON public.projects FOR ALL 
    USING (public.is_org_manager(org_id));

-- 6. Project Members
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recovery_select_project_members" 
    ON public.project_members FOR SELECT 
    USING (project_id IN (SELECT p.id FROM public.projects p WHERE p.org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g)));

CREATE POLICY "recovery_manage_project_members" 
    ON public.project_members FOR ALL 
    USING (project_id IN (SELECT p.id FROM public.projects p WHERE public.is_org_manager(p.org_id)));

-- 7. Tasks (The Core Fix)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recovery_select_tasks" 
    ON public.tasks FOR SELECT 
    USING (
        org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g)
        AND (
            public.is_org_manager(org_id)        -- Managers see all
            OR auth.uid() = employee_id         -- Owners see their work
            OR (assignee_ids IS NOT NULL AND auth.uid() = ANY(assignee_ids)) -- Assignees see work
            OR project_id IS NULL               -- Unified "Main Project" data
        )
    );

CREATE POLICY "recovery_insert_tasks" 
    ON public.tasks FOR INSERT 
    WITH CHECK (org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g) AND public.is_org_manager(org_id));

CREATE POLICY "recovery_update_tasks" 
    ON public.tasks FOR UPDATE 
    USING (
        org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g) 
        AND (public.is_org_manager(org_id) OR auth.uid() = employee_id OR (assignee_ids IS NOT NULL AND auth.uid() = ANY(assignee_ids)))
    );

CREATE POLICY "recovery_delete_tasks" 
    ON public.tasks FOR DELETE 
    USING (org_id IN (SELECT g.org_id FROM public.get_auth_orgs() g) AND (public.is_org_manager(org_id) OR auth.uid() = employee_id));

COMMIT;
