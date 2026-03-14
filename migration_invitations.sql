-- 1. Create Invitations Table
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role public.org_role NOT NULL DEFAULT 'employee',
    token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days',
    UNIQUE(org_id, email)
);

-- 2. Enable RLS
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Use existing get_user_admin_orgs() from previous migration
CREATE POLICY "Admins can manage invitations" 
ON public.invitations FOR ALL 
USING (org_id IN (SELECT public.get_user_admin_orgs()));

CREATE POLICY "Users can view their org invitations" 
ON public.invitations FOR SELECT 
USING (org_id IN (SELECT public.get_user_orgs()));
