-- Fixes cross-tenant data leaks in SECURITY DEFINER RPCs that were callable
-- directly by any authenticated client (supabase.rpc(...)) with no check that
-- the caller actually belongs to the org_id/target_org they passed in.
--
--   public.get_member_profiles  — leaked every member's name/email/role for
--                                  ANY org to any authenticated user.
--   public.org_entitlement      — leaked plan/billing/seat data for ANY org.
--   public.org_active_member_count — leaked member count for ANY org.
--
-- Fix: each function now only returns data when the caller is a member of
-- the org in question, or the call is made with the service-role key (our
-- own server actions, which have already authorized the request themselves).
--
-- public.set_current_org is unused dead code (no RLS policy reads the
-- session variable it sets) that would let any authenticated caller set an
-- arbitrary org_id with zero verification. Locking it down since nothing
-- depends on it being callable by end users.

BEGIN;

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
    JOIN profiles p ON p.id = m.user_id
    WHERE auth.role() = 'service_role'
       OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.org_id = p_org_id AND om.user_id = auth.uid()
       );
$$;

CREATE OR REPLACE FUNCTION public.org_entitlement(target_org UUID)
RETURNS TABLE (
    plan_id TEXT,
    subscription_status subscription_status,
    seat_limit INT,
    project_limit INT,
    seats_used INT,
    projects_used INT,
    features JSONB,
    is_active BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        o.plan_id,
        o.subscription_status,
        p.seat_limit,
        p.project_limit,
        COALESCE(u.active_seats, 0) AS seats_used,
        COALESCE(u.project_count, 0) AS projects_used,
        p.features,
        -- Free plan is always "active". Paid plans require a healthy status.
        (o.plan_id = 'free'
         OR o.subscription_status IN ('trialing', 'active')
         OR (o.subscription_status = 'past_due' AND o.current_period_end > NOW() - INTERVAL '7 days')
        ) AS is_active
    FROM public.organizations o
    JOIN public.plans p ON p.id = o.plan_id
    LEFT JOIN public.org_usage u ON u.org_id = o.id
    WHERE o.id = target_org
      AND (
        auth.role() = 'service_role'
        OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.org_id = target_org AND om.user_id = auth.uid()
        )
      );
$$;

CREATE OR REPLACE FUNCTION public.org_active_member_count(target_org UUID)
RETURNS INT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COUNT(*)::INT
    FROM public.organization_members
    WHERE org_id = target_org
      AND (
        auth.role() = 'service_role'
        OR EXISTS (
            SELECT 1 FROM public.organization_members om
            WHERE om.org_id = target_org AND om.user_id = auth.uid()
        )
      );
$$;

-- Dead code today (no RLS policy references app.current_org_id, and no app
-- code calls this), but it's a live landmine: it lets any authenticated
-- caller set the session's "current org" to any org_id with zero
-- verification. Revoke public callability; keep the function itself in case
-- something references it internally in the future via service-role.
REVOKE EXECUTE ON FUNCTION public.set_current_org(TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_current_org(TEXT) FROM PUBLIC;

COMMIT;

-- ------------------------------------------------------------------
-- Seat-limit race condition fix
-- ------------------------------------------------------------------
-- App code checked `seats_used >= seat_limit` and then inserted into
-- organization_members as two separate steps with no locking, so N
-- concurrent invites near the limit could all pass the check and all
-- insert, overshooting the purchased seat count. Enforce the cap
-- authoritatively in the DB: lock the org row for the duration of the
-- transaction (serializing concurrent inserts for the same org) before
-- counting existing members against the plan's seat_limit.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_seat_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_seat_limit INT;
    v_member_count INT;
BEGIN
    -- Serialize concurrent member-adds for this org: any other transaction
    -- inserting a member for the same org blocks here until we commit/rollback.
    PERFORM 1 FROM public.organizations WHERE id = NEW.org_id FOR UPDATE;

    SELECT p.seat_limit INTO v_seat_limit
    FROM public.organizations o
    JOIN public.plans p ON p.id = o.plan_id
    WHERE o.id = NEW.org_id;

    -- NULL seat_limit = unlimited plan
    IF v_seat_limit IS NOT NULL THEN
        SELECT COUNT(*) INTO v_member_count
        FROM public.organization_members
        WHERE org_id = NEW.org_id;

        IF v_member_count >= v_seat_limit THEN
            RAISE EXCEPTION 'Seat limit reached: this organization is limited to % seats.', v_seat_limit
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_seat_limit ON public.organization_members;
CREATE TRIGGER trg_enforce_seat_limit
    BEFORE INSERT ON public.organization_members
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_seat_limit();

COMMIT;
