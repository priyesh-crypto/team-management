-- ==========================================
-- Audit Log System
-- ==========================================

-- 1. Create the audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  table_name   TEXT NOT NULL,
  record_id    UUID NOT NULL,
  action       TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data     JSONB,
  new_data     JSONB,
  changed_fields TEXT[],          -- only populated on UPDATE
  actor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name   TEXT,              -- denormalized so it survives user deletion
  target_name  TEXT,              -- denormalized name of the task or profile
  ip_address   INET,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_record    ON public.audit_logs (record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor     ON public.audit_logs (actor_id,  created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_org       ON public.audit_logs (org_id,    created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_table     ON public.audit_logs (table_name, created_at DESC);

-- 2. Create the trigger function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id   UUID;
  v_actor_name TEXT;
  v_record_id  UUID;
  v_org_id     UUID;
  v_target_name TEXT;
  v_old        JSONB;
  v_new        JSONB;
  v_changed    TEXT[];
BEGIN
  -- Get actor from Supabase auth context
  v_actor_id := auth.uid();

  -- Resolve actor name
  SELECT name INTO v_actor_name
  FROM public.profiles WHERE id = v_actor_id;

  -- Resolve record_id, org_id, and target_name based on table
  IF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_old       := to_jsonb(OLD);
    v_new       := NULL;
    
    IF TG_TABLE_NAME = 'tasks' THEN
      v_org_id      := OLD.org_id;
      v_target_name := OLD.name;
    ELSIF TG_TABLE_NAME = 'comments' THEN
      SELECT org_id, name INTO v_org_id, v_target_name FROM public.tasks WHERE id = OLD.task_id;
    ELSIF TG_TABLE_NAME = 'profiles' THEN
      SELECT org_id INTO v_org_id FROM public.organization_members WHERE user_id = OLD.id LIMIT 1;
      v_target_name := OLD.name;
    END IF;
    
  ELSIF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_old       := NULL;
    v_new       := to_jsonb(NEW);
    
    IF TG_TABLE_NAME = 'tasks' THEN
      v_org_id      := NEW.org_id;
      v_target_name := NEW.name;
    ELSIF TG_TABLE_NAME = 'comments' THEN
      SELECT org_id, name INTO v_org_id, v_target_name FROM public.tasks WHERE id = NEW.task_id;
    ELSIF TG_TABLE_NAME = 'profiles' THEN
      SELECT org_id INTO v_org_id FROM public.organization_members WHERE user_id = NEW.id LIMIT 1;
      v_target_name := NEW.name;
    END IF;
    
  ELSE -- UPDATE
    v_record_id := NEW.id;
    v_old       := to_jsonb(OLD);
    v_new       := to_jsonb(NEW);
    
    IF TG_TABLE_NAME = 'tasks' THEN
      v_org_id      := NEW.org_id;
      v_target_name := NEW.name;
    ELSIF TG_TABLE_NAME = 'comments' THEN
      SELECT org_id, name INTO v_org_id, v_target_name FROM public.tasks WHERE id = NEW.task_id;
    ELSIF TG_TABLE_NAME = 'profiles' THEN
      SELECT org_id INTO v_org_id FROM public.organization_members WHERE user_id = NEW.id LIMIT 1;
      v_target_name := NEW.name;
    END IF;

    -- Compute which fields actually changed
    SELECT array_agg(key)
    INTO v_changed
    FROM jsonb_each(to_jsonb(NEW)) n
    JOIN jsonb_each(to_jsonb(OLD)) o USING (key)
    WHERE n.value IS DISTINCT FROM o.value
      AND key NOT IN ('updated_at');
  END IF;

  -- Fallback: if org_id is still null, try actor's org
  IF v_org_id IS NULL AND v_actor_id IS NOT NULL THEN
    SELECT org_id INTO v_org_id FROM public.organization_members WHERE user_id = v_actor_id LIMIT 1;
  END IF;

  -- If we can't find org_id, skip logging to avoid breaking the UI
  IF v_org_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Skip UPDATE if nothing meaningful changed
  IF TG_OP = 'UPDATE' AND (v_changed IS NULL OR array_length(v_changed, 1) = 0) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_logs (
    org_id, table_name, record_id, action,
    old_data, new_data, changed_fields,
    actor_id, actor_name, target_name
  ) VALUES (
    v_org_id, TG_TABLE_NAME, v_record_id, TG_OP,
    v_old, v_new, v_changed,
    v_actor_id, v_actor_name, v_target_name
  );

  RETURN NEW;
END;
$$;

-- 3. Attach triggers to tables
-- Tasks
DROP TRIGGER IF EXISTS audit_tasks ON public.tasks;
CREATE TRIGGER audit_tasks
  AFTER INSERT OR UPDATE OR DELETE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Comments
DROP TRIGGER IF EXISTS audit_comments ON public.comments;
CREATE TRIGGER audit_comments
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- Profiles
DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

-- 4. RLS Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Managers: read all logs in their org
DROP POLICY IF EXISTS "managers_read_all_audit_logs" ON public.audit_logs;
CREATE POLICY "managers_read_all_audit_logs"
  ON public.audit_logs FOR SELECT
  USING (
    org_id = (SELECT org_id FROM public.profiles WHERE id = auth.uid())
    AND
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'manager'
  );

-- Employees: only see their own actions
DROP POLICY IF EXISTS "employees_read_own_audit_logs" ON public.audit_logs;
CREATE POLICY "employees_read_own_audit_logs"
  ON public.audit_logs FOR SELECT
  USING (
    actor_id = auth.uid()
  );

-- Nobody inserts directly
DROP POLICY IF EXISTS "no_direct_insert" ON public.audit_logs;
CREATE POLICY "no_direct_insert"
  ON public.audit_logs FOR INSERT
  WITH CHECK (FALSE);

-- Nobody updates or deletes audit logs
DROP POLICY IF EXISTS "no_update" ON public.audit_logs;
CREATE POLICY "no_update"
  ON public.audit_logs FOR UPDATE
  USING (FALSE);

DROP POLICY IF EXISTS "no_delete" ON public.audit_logs;
CREATE POLICY "no_delete"
  ON public.audit_logs FOR DELETE
  USING (FALSE);
