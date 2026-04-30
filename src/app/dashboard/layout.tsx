import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getEntitlement } from '@/lib/entitlements';
import { EntitlementProvider } from '@/context/EntitlementContext';
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner';

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

  // ── Impersonation check ──────────────────────────────────────────────────
  const cookieStore = await cookies();
  const impersonateSessionId = cookieStore.get('__impersonate')?.value;

  let orgId: string | null = null;
  let isImpersonating = false;
  let impersonatedOrgName = '';

  if (impersonateSessionId) {
    const adminClient = createAdminClient();
    const { data: session } = await adminClient
      .from('impersonation_sessions')
      .select('target_org_id, ended_at, organizations(name)')
      .eq('id', impersonateSessionId)
      .is('ended_at', null)
      .single();

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

  // ── Suspension check ────────────────────────────────────────────────────
  const adminClient = createAdminClient();
  const { data: orgData } = await adminClient
    .from('organizations')
    .select('suspended_at, suspended_reason, name')
    .eq('id', orgId)
    .single();

  if (orgData?.suspended_at && !isImpersonating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7] p-6">
        <div className="bg-white rounded-3xl shadow-sm border border-[#e5e5ea] p-10 max-w-md text-center space-y-4">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-black text-[#1d1d1f]">Account suspended</h1>
          <p className="text-sm text-[#86868b]">
            {orgData.suspended_reason
              ? `Reason: ${orgData.suspended_reason}`
              : 'Your organization has been suspended. Please contact support.'}
          </p>
          <a
            href="mailto:support@mindbird.ai"
            className="inline-block px-6 py-3 rounded-xl bg-[#0c64ef] text-white text-sm font-black hover:bg-[#005bb7] transition-colors"
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
      {isImpersonating && <ImpersonationBanner orgName={impersonatedOrgName} />}
      <div className={isImpersonating ? 'pt-10' : ''}>
        {children}
      </div>
    </EntitlementProvider>
  );
}
