-- ================================================================
-- ATTACHMENT SYSTEM SETUP
-- Run this in Supabase SQL Editor
-- ================================================================

-- 1. Add missing enum values to activity_type
DO $$
BEGIN
    ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'subtask_created';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'attachment_added';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'attachment_deleted';
EXCEPTION WHEN others THEN NULL;
END $$;

-- 2. Ensure attachments table has correct defaults
ALTER TABLE public.attachments ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 3. Create the storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'task-attachments',
    'task-attachments',
    true,
    52428800,  -- 50MB limit
    NULL       -- Allow all file types
)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage RLS Policies (drop first to avoid conflicts)
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

DROP POLICY IF EXISTS "Allow public reads" ON storage.objects;
CREATE POLICY "Allow public reads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'task-attachments');

DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'task-attachments');

-- 5. Attachments table RLS policies
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attachments_select" ON public.attachments;
CREATE POLICY "attachments_select" ON public.attachments
FOR SELECT USING (true);

DROP POLICY IF EXISTS "attachments_insert" ON public.attachments;
CREATE POLICY "attachments_insert" ON public.attachments
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM organization_members
        WHERE user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "attachments_delete" ON public.attachments;
CREATE POLICY "attachments_delete" ON public.attachments
FOR DELETE USING (
    uploader_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM organization_members
        WHERE user_id = auth.uid() AND role IN ('manager', 'owner')
    )
);
