-- ==============================================================================
-- Admin Tier 3: GDPR compliance, Support tickets, System health
-- Additive-only. Safe to re-run (idempotent).
-- ==============================================================================

BEGIN;

-- ── 1. GDPR requests ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gdpr_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    user_id       UUID NOT NULL,
    type          TEXT NOT NULL CHECK (type IN ('export', 'anonymize')),
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    notes         TEXT,
    file_url      TEXT,
    requested_by  UUID NOT NULL,
    requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at  TIMESTAMPTZ
);

ALTER TABLE public.gdpr_requests ADD COLUMN IF NOT EXISTS notes       TEXT;
ALTER TABLE public.gdpr_requests ADD COLUMN IF NOT EXISTS file_url    TEXT;
ALTER TABLE public.gdpr_requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS gdpr_requests_user_idx  ON public.gdpr_requests (user_id, requested_at DESC);
CREATE INDEX IF NOT EXISTS gdpr_requests_org_idx   ON public.gdpr_requests (org_id, requested_at DESC);

ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins manage gdpr requests" ON public.gdpr_requests;
CREATE POLICY "Platform admins manage gdpr requests"
    ON public.gdpr_requests FOR ALL
    USING (public.is_platform_admin());

-- ── 2. Support tickets ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    opened_by   UUID NOT NULL,
    subject     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority    TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    assigned_to UUID,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS assigned_to UUID;
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS support_tickets_status_idx  ON public.support_tickets (status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_org_idx     ON public.support_tickets (org_id, created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins manage support tickets" ON public.support_tickets;
CREATE POLICY "Platform admins manage support tickets"
    ON public.support_tickets FOR ALL
    USING (public.is_platform_admin());

-- ── 3. Support messages ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id   UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL,
    body        TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_messages ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS support_messages_ticket_idx
    ON public.support_messages (ticket_id, created_at);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admins manage support messages" ON public.support_messages;
CREATE POLICY "Platform admins manage support messages"
    ON public.support_messages FOR ALL
    USING (public.is_platform_admin());

COMMIT;
