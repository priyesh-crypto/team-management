-- ============================================================
-- Tenant logo storage for the owner portal's branding panel.
--
-- Logos are uploaded by PLATFORM ADMINS on behalf of a client org
-- (Admin -> Organizations -> <org> -> Branding), so writes are
-- restricted to platform admins rather than org members.
--
-- Reads are public: the logo renders on the login page, which is
-- unauthenticated by definition.
--
-- Safe to re-run.
-- ============================================================

-- 1. Bucket ---------------------------------------------------
-- 2 MB is generous for a logo and keeps the login page fast.
-- SVG is deliberately excluded: the bucket is public and SVG can
-- carry inline JavaScript, which would be stored XSS on our own
-- origin. PNG/JPEG/WebP only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'org-branding',
    'org-branding',
    true,
    2097152, -- 2 MB
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon']::text[]
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon']::text[];


-- 2. Storage RLS ----------------------------------------------
-- Objects are laid out as "<org_id>/<logo|favicon>-<timestamp>.<ext>".

-- Anyone may view a tenant logo (needed pre-auth on the login page).
DROP POLICY IF EXISTS "org_branding_public_read" ON storage.objects;
CREATE POLICY "org_branding_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'org-branding');

-- Only platform admins may add, replace or remove a tenant logo.
-- public.is_platform_admin() is defined in 20260428_platform_admin.sql.
DROP POLICY IF EXISTS "org_branding_admin_insert" ON storage.objects;
CREATE POLICY "org_branding_admin_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'org-branding'
    AND public.is_platform_admin()
    AND array_length(storage.foldername(name), 1) = 1
);

DROP POLICY IF EXISTS "org_branding_admin_update" ON storage.objects;
CREATE POLICY "org_branding_admin_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'org-branding'
    AND public.is_platform_admin()
)
WITH CHECK (
    bucket_id = 'org-branding'
    AND public.is_platform_admin()
    AND array_length(storage.foldername(name), 1) = 1
);

DROP POLICY IF EXISTS "org_branding_admin_delete" ON storage.objects;
CREATE POLICY "org_branding_admin_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'org-branding'
    AND public.is_platform_admin()
);


-- 3. Let platform admins manage any org's branding row --------
-- org_branding's existing policies (20260430_phase4_features.sql) only cover
-- org members. The owner portal edits branding for orgs the admin does not
-- belong to, so it needs its own policy.
DROP POLICY IF EXISTS "org_branding_platform_admin_all" ON public.org_branding;
CREATE POLICY "org_branding_platform_admin_all"
ON public.org_branding
FOR ALL
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());
