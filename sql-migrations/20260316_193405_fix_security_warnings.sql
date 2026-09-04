-- Fix Function Search Path Mutable warnings
-- This ensures functions always use the intended schema for queries

-- 1. get_user_orgs
ALTER FUNCTION public.get_user_orgs() SET search_path = public;

-- 2. get_user_admin_orgs
ALTER FUNCTION public.get_user_admin_orgs() SET search_path = public;

-- 3. handle_new_user
ALTER FUNCTION public.handle_new_user() SET search_path = public;
