import { createClient } from '@/utils/supabase/server';
import DashboardContainer from '@/components/DashboardContainer';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  const { data: mData } = await supabase
    .from('organization_members')
    .select('org_id, organizations(name)')
    .eq('user_id', user.id)
    .single();

  if (!mData) redirect('/');

  const orgName = (mData.organizations as any)?.name || 'Your Workspace';

  return (
    <DashboardContainer 
      userId={user.id}
      userName={profile?.name || ''}
      userRole={profile?.role || 'employee'}
      orgName={orgName}
    />
  );
}
