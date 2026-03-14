-- ==============================================================================
-- MIGRATION: ACTIVITY LOGS
-- Purpose: Track task and workspace events for audit trails and timeline UI.
-- ==============================================================================

BEGIN;

-- 1. Create activity_type enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type') THEN
        CREATE TYPE activity_type AS ENUM (
            'task_created', 
            'task_status_changed', 
            'task_priority_changed',
            'task_deleted',
            'comment_added',
            'member_invited',
            'member_joined',
            'subtask_completed'
        );
    END IF;
END $$;

-- 2. Create activity_logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
    type activity_type NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Users can view activity logs in their orgs" 
ON public.activity_logs 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.organization_members 
        WHERE org_id = activity_logs.org_id 
        AND user_id = auth.uid()
    )
);

-- Note: Insertion is handled by server actions using service_role or restricted but we can add a basic insert policy if needed.
-- For now, SELECT is the primary requirement for visibility.

COMMIT;
