import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { getEntitlement } from '@/lib/entitlements';
import { EntitlementProvider } from '@/context/EntitlementContext';

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

  const { data: mData } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id);

  if (!mData || mData.length === 0) {
    redirect('/');
  }

  const orgId = mData[0].org_id;
  const entitlement = await getEntitlement(orgId);

  return (
    <EntitlementProvider entitlement={entitlement}>
      {children}
    </EntitlementProvider>
  );
}
