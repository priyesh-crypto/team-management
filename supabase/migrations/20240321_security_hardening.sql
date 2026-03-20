-- ==========================================
-- Security Hardening Migration (V2 - IDOR Protection)
-- ==========================================

BEGIN;

-- 1. Tighten Profiles RLS
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles within their organizations" ON public.profiles;
DROP POLICY IF EXISTS "Users can only view profiles within their own organizations" ON public.profiles;

CREATE POLICY "Users can only view profiles within their own organizations" ON public.profiles
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.organization_members AS m1
    JOIN public.organization_members AS m2 ON m1.org_id = m2.org_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = profiles.id
  )
);

-- 2. Secure Notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Users can view their own notifications." ON public.notifications;
CREATE POLICY "Users can view their own notifications." ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Managers can insert notifications for anyone." ON public.notifications;
DROP POLICY IF EXISTS "Org Managers can insert notifications" ON public.notifications;
CREATE POLICY "Org Managers can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid() AND org_id = notifications.org_id AND role IN ('owner', 'admin', 'manager')
    )
  );

-- 3. Secure Comments
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Comments are viewable by everyone." ON public.comments;
DROP POLICY IF EXISTS "Users can only view comments in their organizations" ON public.comments;
CREATE POLICY "Users can only view comments in their organizations" ON public.comments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND org_id = comments.org_id
  )
);

DROP POLICY IF EXISTS "Anyone with access to the task can insert a comment." ON public.comments;
DROP POLICY IF EXISTS "Org members can comment on their tasks" ON public.comments;
CREATE POLICY "Org members can comment on their tasks" ON public.comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid() AND org_id = comments.org_id
    )
  );

-- 4. Secure Attachments (Idempotent IDOR Protection)
ALTER TABLE public.attachments ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Tenant Isolation: View Attachments" ON public.attachments;
DROP POLICY IF EXISTS "Users can view attachments in their orgs" ON public.attachments;
CREATE POLICY "Users can view attachments in their orgs" ON public.attachments
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = attachments.org_id
        AND user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Tenant Isolation: Insert Attachments" ON public.attachments;
DROP POLICY IF EXISTS "Users can insert attachments in their orgs" ON public.attachments;
CREATE POLICY "Users can insert attachments in their orgs" ON public.attachments
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = attachments.org_id
        AND user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Tenant Isolation: Delete Attachments" ON public.attachments;
DROP POLICY IF EXISTS "Owners/Admins can delete attachments in their orgs" ON public.attachments;
CREATE POLICY "Owners/Admins can delete attachments in their orgs" ON public.attachments
FOR DELETE USING (
    uploader_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.organization_members
        WHERE org_id = attachments.org_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
);

-- 5. Secure Activity Logs (IDOR Protection)
DROP POLICY IF EXISTS "Users can view activity logs in their orgs" ON public.activity_logs;
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

-- 6. Rate Limiting Tables
CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,
    action TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT,
    email TEXT,
    success BOOLEAN,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_identifier_action ON public.rate_limit_logs(identifier, action, created_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_email ON public.login_attempts(ip_address, email, attempted_at);

ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

COMMIT;
