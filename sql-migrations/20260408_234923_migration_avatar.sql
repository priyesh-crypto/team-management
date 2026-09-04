-- ============================================================
-- Avatar / Profile Picture Support
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add avatar_url column to profiles
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ============================================================
-- 2. Supabase Storage bucket
--    Constraints mirror the app-layer checks in uploadAvatar():
--    5 MB cap and images only (no SVG - it can carry inline JS,
--    which would be stored XSS on a public bucket).
--    DO UPDATE (not DO NOTHING) so re-running this retroactively
--    enforces the limits on a bucket created without them.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    5242880, -- 5 MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[];

-- 3. Storage RLS Policies

-- Allow authenticated users to upload to their own folder.
-- The array_length check pins uploads to "<uid>/<file>" - the layout
-- uploadAvatar() writes - so the folder can't be used as arbitrary
-- nested file storage.
DROP POLICY IF EXISTS "avatar_insert" ON storage.objects;
CREATE POLICY "avatar_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND array_length(storage.foldername(name), 1) = 1
);

-- Allow authenticated users to update (overwrite) their own avatar.
-- USING gates which rows are visible to the UPDATE; WITH CHECK gates the
-- result, so a user can't rename a file out of their own folder.
DROP POLICY IF EXISTS "avatar_update" ON storage.objects;
CREATE POLICY "avatar_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND array_length(storage.foldername(name), 1) = 1
);

-- Allow authenticated users to delete their own avatar
DROP POLICY IF EXISTS "avatar_delete" ON storage.objects;
CREATE POLICY "avatar_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anyone (public) to view avatars
DROP POLICY IF EXISTS "avatar_select" ON storage.objects;
CREATE POLICY "avatar_select"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');
