-- ==========================================
-- FIX: Function Search Path & Security
-- Resolves "Function Search Path Mutable" warning.
-- ==========================================

-- 1. Fix get_daily_digest Search Path
-- Adding SET search_path = public prevents search path hijacking.
CREATE OR REPLACE FUNCTION public.get_daily_digest(p_user_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT JSON_BUILD_OBJECT(
    'due_today', (
      -- Corrected 'title' to 'name' based on schema
      SELECT JSON_AGG(JSON_BUILD_OBJECT('id', id, 'title', name, 'priority', priority))
      FROM public.tasks
      WHERE employee_id = p_user_id
        AND status NOT IN ('Completed', 'Cancelled')
        AND deadline::DATE = CURRENT_DATE
    ),
    'overdue', (
      SELECT JSON_AGG(JSON_BUILD_OBJECT('id', id, 'title', name, 'priority', priority, 'days_late',
        (CURRENT_DATE - deadline::DATE)))
      FROM public.tasks
      WHERE employee_id = p_user_id
        AND status NOT IN ('Completed', 'Cancelled')
        AND deadline::DATE < CURRENT_DATE
    ),
    'completed_yesterday', (
      SELECT JSON_AGG(JSON_BUILD_OBJECT('id', id, 'title', name))
      FROM public.tasks
      WHERE employee_id = p_user_id
        AND status = 'Completed'
        AND updated_at::DATE = (CURRENT_DATE - INTERVAL '1 day')::DATE
    ),
    'blocked', (
      SELECT JSON_AGG(JSON_BUILD_OBJECT('id', id, 'title', name))
      FROM public.tasks
      WHERE employee_id = p_user_id
        AND status = 'Blocked'
    ),
    'upcoming', (
      SELECT JSON_AGG(JSON_BUILD_OBJECT('id', id, 'title', name, 'deadline', deadline))
      FROM public.tasks
      WHERE employee_id = p_user_id
        AND status NOT IN ('Completed', 'Cancelled')
        AND deadline::DATE BETWEEN (CURRENT_DATE + 1) AND (CURRENT_DATE + 3)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 2. Update existing server-side functions in master fix to also have search_path
-- These are the helpers I added in the previous step.

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
