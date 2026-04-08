-- ============================================================
-- Avatar / Profile Picture Support
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add avatar_url column to profiles
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ============================================================
-- 2. Supabase Storage bucket (run ONCE via SQL Editor)
--    If you prefer the Dashboard:
--    Storage → New Bucket → Name: "avatars", Public: ON
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS Policies

-- Allow authenticated users to upload to their own folder
CREATE POLICY "avatar_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update (overwrite) their own avatar
CREATE POLICY "avatar_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own avatar
CREATE POLICY "avatar_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow anyone (public) to view avatars
CREATE POLICY "avatar_select"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');
