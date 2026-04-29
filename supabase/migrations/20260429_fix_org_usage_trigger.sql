-- Fix: Prevent org_usage recomputation during organization cascade deletes
-- to avoid foreign key violations when the parent organization is already deleted.

CREATE OR REPLACE FUNCTION public.recompute_org_usage(target_org UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Skip if the organization is already deleted (e.g. during a CASCADE DELETE)
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = target_org) THEN
        RETURN;
    END IF;

    INSERT INTO public.org_usage (org_id, active_seats, project_count, task_count, updated_at)
    SELECT
        target_org,
        (SELECT COUNT(*) FROM public.organization_members WHERE org_id = target_org),
        COALESCE((SELECT COUNT(*) FROM public.workspaces WHERE org_id = target_org), 0),
        COALESCE((SELECT COUNT(*) FROM public.tasks WHERE org_id = target_org), 0),
        NOW()
    ON CONFLICT (org_id) DO UPDATE SET
        active_seats = EXCLUDED.active_seats,
        project_count = EXCLUDED.project_count,
        task_count = EXCLUDED.task_count,
        updated_at = NOW();
END;
$$;
