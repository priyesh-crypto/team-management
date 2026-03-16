import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

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

  // Check organziation membership
  const { data: mData } = await supabase
    .from('organization_members')
    .select('org_id')
    .eq('user_id', user.id);

  if (!mData || mData.length === 0) {
    redirect('/');
  }

  return <>{children}</>;
}
