-- ==============================================================================
-- MULTI-TENANT MIGRATION SCRIPT
-- Purpose: Adds multi-tenancy to existing Task Management DB
-- Instructions: Run this script precisely once in the Supabase SQL Editor.
-- ==============================================================================

BEGIN;

-- 1. Create Core Multi-Tenant Tables
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Safely create org_role enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'org_role') THEN
        CREATE TYPE org_role AS ENUM ('owner', 'admin', 'manager', 'employee');
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.organization_members (
    org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role org_role NOT NULL DEFAULT 'employee',
    PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Alter Existing Tables Safely
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.subtasks ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 3. Data Migration (Backfill)
DO $$
DECLARE
    legacy_org_id UUID;
    legacy_workspace_id UUID;
BEGIN
    -- Only create if tasks table exists and has rows but no org_id values
    IF EXISTS (SELECT 1 FROM public.tasks WHERE org_id IS NULL LIMIT 1) THEN
        -- Insert Legacy Organization
        INSERT INTO public.organizations (name)
        VALUES ('Legacy Organization')
        RETURNING id INTO legacy_org_id;

        -- Insert Legacy Workspace
        INSERT INTO public.workspaces (org_id, name)
        VALUES (legacy_org_id, 'Default Workspace')
        RETURNING id INTO legacy_workspace_id;

        -- Map all existing users from profiles to this organization
        INSERT INTO public.organization_members (org_id, user_id, role)
        SELECT 
            legacy_org_id, 
            id, 
            CASE WHEN role = 'manager' THEN 'owner'::org_role ELSE 'employee'::org_role END
        FROM public.profiles
        ON CONFLICT DO NOTHING;

        -- Assign all tasks to this org and workspace
        UPDATE public.tasks SET org_id = legacy_org_id, workspace_id = legacy_workspace_id WHERE org_id IS NULL;
        
        -- Assign all subtasks to this org
        UPDATE public.subtasks SET org_id = legacy_org_id WHERE org_id IS NULL;
    END IF;
END $$;

-- Enforce NOT NULL now that data is backfilled
-- (Wait, if there are NO tasks at all, the above script won't run, but then NULLs don't exist, so this is safe)
ALTER TABLE public.tasks ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.tasks ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.subtasks ALTER COLUMN org_id SET NOT NULL;

-- 4. Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
-- tasks and subtasks should already have RLS, but just to be sure
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

-- 5. Drop Legacy Policies on Tasks/Subtasks to avoid conflicts (Safe Reset)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'tasks'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.tasks';
    END LOOP;
    
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'subtasks'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.policyname) || ' ON public.subtasks';
    END LOOP;
END $$;

-- 6. Centralized Tenant Isolation Policies

-- Organizations
CREATE POLICY "Users can view orgs they belong to" ON public.organizations FOR SELECT USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = id AND user_id = auth.uid()));
CREATE POLICY "Org admins can update orgs" ON public.organizations FOR UPDATE USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = id AND user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Org Members
CREATE POLICY "Users can view members of their orgs" ON public.organization_members FOR SELECT USING (EXISTS (SELECT 1 FROM public.organization_members AS v WHERE v.org_id = organization_members.org_id AND v.user_id = auth.uid()));
CREATE POLICY "Admins can manage members" ON public.organization_members FOR ALL USING (EXISTS (SELECT 1 FROM public.organization_members AS v WHERE v.org_id = organization_members.org_id AND v.user_id = auth.uid() AND v.role IN ('owner', 'admin')));
-- Allow insertion during self-signup onboarding if creating a new org (we'll grant service_role privileges in actions.ts for creating new orgs/members)

-- Workspaces
CREATE POLICY "Users can view workspaces in their orgs" ON public.workspaces FOR SELECT USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = workspaces.org_id AND user_id = auth.uid()));
CREATE POLICY "Admins can manage workspaces" ON public.workspaces FOR ALL USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = workspaces.org_id AND user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Tasks
CREATE POLICY "Tenant Isolation: Select Tasks" ON public.tasks FOR SELECT USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = tasks.org_id AND user_id = auth.uid()));
CREATE POLICY "Tenant Isolation: Insert Tasks" ON public.tasks FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = tasks.org_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')));
CREATE POLICY "Tenant Isolation: Update Tasks" ON public.tasks FOR UPDATE USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = tasks.org_id AND user_id = auth.uid()));
CREATE POLICY "Tenant Isolation: Delete Tasks" ON public.tasks FOR DELETE USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = tasks.org_id AND user_id = auth.uid() AND role IN ('owner', 'admin', 'manager')));

-- Subtasks
CREATE POLICY "Tenant Isolation: Select Subtasks" ON public.subtasks FOR SELECT USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = subtasks.org_id AND user_id = auth.uid()));
CREATE POLICY "Tenant Isolation: Insert Subtasks" ON public.subtasks FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = subtasks.org_id AND user_id = auth.uid()));
CREATE POLICY "Tenant Isolation: Update Subtasks" ON public.subtasks FOR UPDATE USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = subtasks.org_id AND user_id = auth.uid()));
CREATE POLICY "Tenant Isolation: Delete Subtasks" ON public.subtasks FOR DELETE USING (EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = subtasks.org_id AND user_id = auth.uid()));

COMMIT;
