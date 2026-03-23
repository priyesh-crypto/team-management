import { createClient } from '@/utils/supabase/server';
import DashboardContainer from '@/components/DashboardContainer';
import { redirect } from 'next/navigation';
import { getDashboardData } from '@/app/actions/actions';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  // 1. Parallelize context queries
  const [profileRes, mDataRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('organization_members')
      .select('org_id, organizations(name)')
      .eq('user_id', user.id)
  ]);

  const profile = profileRes.data;
  const mData = mDataRes.data?.[0];

  if (!mData) redirect('/');

  const orgName = (mData.organizations as any)?.name || 'Your Workspace';
  
  // 2. Prefetch dashboard data with provided context to avoid redundancy
  const initialData = await getDashboardData(undefined, mData.org_id, user.id);

  return (
    <DashboardContainer 
      userId={user.id}
      userName={profile?.name || ''}
      userRole={profile?.role || 'employee'}
      orgName={orgName}
      orgId={mData.org_id}
      initialData={initialData}
    />
  );
}
