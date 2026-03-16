-- ==========================================
-- Daily Digest System Schema
-- ==========================================

-- 1. Digest Preferences Table
CREATE TABLE IF NOT EXISTS public.digest_preferences (
  user_id       UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel       TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'slack', 'both', 'none')),
  send_time     TIME NOT NULL DEFAULT '08:00:00',
  timezone      TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  slack_user_id TEXT,
  send_on_weekends BOOLEAN DEFAULT false,
  is_active     BOOLEAN DEFAULT true,
  last_sent_at  TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.digest_preferences ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own digest preferences"
  ON public.digest_preferences
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. get_daily_digest(p_user_id uuid) Function
CREATE OR REPLACE FUNCTION public.get_daily_digest(p_user_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT JSON_BUILD_OBJECT(
    'due_today', (
      SELECT JSON_AGG(JSON_BUILD_OBJECT('id', id, 'title', title, 'priority', priority))
      FROM public.tasks
      WHERE employee_id = p_user_id
        AND status NOT IN ('Completed', 'Cancelled')
        AND deadline::DATE = CURRENT_DATE
    ),
    'overdue', (
      SELECT JSON_AGG(JSON_BUILD_OBJECT('id', id, 'title', title, 'priority', priority, 'days_late',
        (CURRENT_DATE - deadline::DATE)))
      FROM public.tasks
      WHERE employee_id = p_user_id
        AND status NOT IN ('Completed', 'Cancelled')
        AND deadline::DATE < CURRENT_DATE
    ),
    'completed_yesterday', (
      SELECT JSON_AGG(JSON_BUILD_OBJECT('id', id, 'title', title))
      FROM public.tasks
      WHERE employee_id = p_user_id
        AND status = 'Completed'
        AND updated_at::DATE = (CURRENT_DATE - INTERVAL '1 day')::DATE
    ),
    'blocked', (
      SELECT JSON_AGG(JSON_BUILD_OBJECT('id', id, 'title', title))
      FROM public.tasks
      WHERE employee_id = p_user_id
        AND status = 'Blocked'
    ),
    'upcoming', (
      SELECT JSON_AGG(JSON_BUILD_OBJECT('id', id, 'title', title, 'deadline', deadline))
      FROM public.tasks
      WHERE employee_id = p_user_id
        AND status NOT IN ('Completed', 'Cancelled')
        AND deadline::DATE BETWEEN (CURRENT_DATE + 1) AND (CURRENT_DATE + 3)
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
