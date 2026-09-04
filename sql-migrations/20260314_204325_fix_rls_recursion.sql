-- Fix Infinite Recursion in organization_members RLS policies and optimize others

BEGIN;

-- 1. Create SECURITY DEFINER functions to bypass RLS when looking up user's own memberships
CREATE OR REPLACE FUNCTION public.get_user_orgs()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT org_id FROM public.organization_members WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_user_admin_orgs()
RETURNS SETOF UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT org_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'manager');
$$;

-- 2. Drop the recursive and less efficient policies
DROP POLICY IF EXISTS "Users can view members of their orgs" ON public.organization_members;
DROP POLICY IF EXISTS "Admins can manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can view orgs they belong to" ON public.organizations;
DROP POLICY IF EXISTS "Org admins can update orgs" ON public.organizations;
DROP POLICY IF EXISTS "Users can view workspaces in their orgs" ON public.workspaces;
DROP POLICY IF EXISTS "Admins can manage workspaces" ON public.workspaces;

-- 3. Recreate policies using the non-recursive, cached functions

-- Org Members
CREATE POLICY "Users can view members of their orgs" 
ON public.organization_members FOR SELECT 
USING (org_id IN (SELECT public.get_user_orgs()));

CREATE POLICY "Admins can manage members" 
ON public.organization_members FOR ALL 
USING (org_id IN (SELECT public.get_user_admin_orgs()));

-- Organizations
CREATE POLICY "Users can view orgs they belong to" 
ON public.organizations FOR SELECT 
USING (id IN (SELECT public.get_user_orgs()));

CREATE POLICY "Org admins can update orgs" 
ON public.organizations FOR UPDATE 
USING (id IN (SELECT public.get_user_admin_orgs()));

-- Workspaces
CREATE POLICY "Users can view workspaces in their orgs" 
ON public.workspaces FOR SELECT 
USING (org_id IN (SELECT public.get_user_orgs()));

CREATE POLICY "Admins can manage workspaces" 
ON public.workspaces FOR ALL 
USING (org_id IN (SELECT public.get_user_admin_orgs()));

COMMIT;
