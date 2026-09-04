import type { Metadata } from 'next';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getEntitlement } from '@/lib/entitlements';
import { EntitlementProvider } from '@/context/EntitlementContext';
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner';
import { getOrgBranding } from '@/lib/branding-server';
import { BrandingProvider } from '@/context/BrandingContext';
import { BrandingStyle } from '@/components/branding/BrandingStyle';

// All queries below are wrapped in try/catch and degrade gracefully when their
// underlying migrations have not been applied. This prevents the entire
// dashboard from crashing if `admin_tier1` (impersonation_sessions, suspended_*,
// org_feature_overrides) hasn't been run yet.

async function tryGetImpersonation(sessionId: string) {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('impersonation_sessions')
      .select('target_org_id, ended_at, organizations(name)')
      .eq('id', sessionId)
      .is('ended_at', null)
      .single();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

async function tryGetSuspension(orgId: string) {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('organizations')
      .select('suspended_at, suspended_reason, name')
      .eq('id', orgId)
      .single();
    if (error) {
      // Likely the suspended_* columns don't exist yet — fall back to a name-only query
      const fallback = await admin.from('organizations').select('name').eq('id', orgId).single();
      return fallback.data ? { suspended_at: null, suspended_reason: null, name: fallback.data.name } : null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Per-tenant tab title and favicon.
 *
 * Resolved independently of the layout body — Next calls this separately, and
 * both paths hit the same request-memoized Supabase query.
 */
export async function generateMetadata(): Promise<Metadata> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return {};

    const { data } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1);
    const orgId = data?.[0]?.org_id;
    if (!orgId) return {};

    const branding = await getOrgBranding(orgId);
    return {
      title: branding.name,
      icons: { icon: branding.faviconUrl },
    };
  } catch {
    return {};
  }
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  if (!user.email_confirmed_at) {
    redirect('/?error=email_not_verified');
  }

  // ── Impersonation check (gracefully no-ops if admin_tier1 is unapplied) ──
  const cookieStore = await cookies();
  const impersonateSessionId = cookieStore.get('__impersonate')?.value;

  let orgId: string | null = null;
  let isImpersonating = false;
  let impersonatedOrgName = '';

  if (impersonateSessionId) {
    const session = await tryGetImpersonation(impersonateSessionId);
    if (session) {
      orgId = session.target_org_id;
      isImpersonating = true;
      const orgs = session.organizations as unknown as { name: string } | null;
      impersonatedOrgName = orgs?.name ?? 'Unknown org';
    }
  }

  // Fall back to the user's real org
  if (!orgId) {
    const { data: mData } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id);

    if (!mData || mData.length === 0) {
      redirect('/');
    }
    orgId = mData[0].org_id;
  }

  // ── Suspension check (gracefully no-ops if admin_tier1 is unapplied) ────
  const orgData = await tryGetSuspension(orgId!);

  // Resolved before the suspension branch so the suspended screen is branded
  // too — it's the one page a locked-out customer definitely sees.
  const branding = await getOrgBranding(orgId!);

  if (orgData?.suspended_at && !isImpersonating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] p-6">
        <BrandingStyle branding={branding} />
        <div className="bg-white rounded-3xl shadow-sm border border-[#e5e5ea] p-10 max-w-md text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-black text-[#1d1d1f]">Account suspended</h1>
          <p className="text-sm text-[#86868b]">
            {orgData.suspended_reason
              ? `Reason: ${orgData.suspended_reason}`
              : 'Your organization has been suspended. Please contact support.'}
          </p>
          <a
            href={`mailto:${branding.supportEmail}`}
            className="inline-block px-6 py-3 rounded-xl bg-brand-blue text-white text-sm font-black hover:bg-brand-blue-dark transition-colors"
          >
            Contact support
          </a>
        </div>
      </div>
    );
  }

  const entitlement = await getEntitlement(orgId!);

  return (
    <EntitlementProvider entitlement={entitlement}>
      <BrandingProvider branding={branding}>
        <BrandingStyle branding={branding} />
        {isImpersonating && <ImpersonationBanner orgName={impersonatedOrgName} />}
        <div className={isImpersonating ? 'pt-10' : ''}>
          {children}
        </div>
      </BrandingProvider>
    </EntitlementProvider>
  );
}
