-- ==============================================================================
-- MIGRATION: ADD TASK ATTACHMENTS
-- Purpose: Support file/link attachments for tasks.
-- ==============================================================================

BEGIN;

-- 1. Create attachments table
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES public.profiles(id),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- 3. Create Isolation Policies
CREATE POLICY "Tenant Isolation: View Attachments" ON public.attachments
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.tasks
        WHERE tasks.id = attachments.task_id
        AND EXISTS (
            SELECT 1 FROM public.organization_members
            WHERE organization_members.org_id = tasks.org_id
            AND organization_members.user_id = auth.uid()
        )
    )
);

CREATE POLICY "Tenant Isolation: Insert Attachments" ON public.attachments
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.tasks
        WHERE tasks.id = attachments.task_id
        AND EXISTS (
            SELECT 1 FROM public.organization_members
            WHERE organization_members.org_id = tasks.org_id
            AND organization_members.user_id = auth.uid()
        )
    )
);

CREATE POLICY "Tenant Isolation: Delete Attachments" ON public.attachments
FOR DELETE USING (
    uploader_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.organization_members om
        JOIN public.tasks t ON t.org_id = om.org_id
        WHERE t.id = attachments.task_id
        AND om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager')
    )
);

COMMIT;
