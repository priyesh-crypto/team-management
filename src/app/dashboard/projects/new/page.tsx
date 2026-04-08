import { createClient } from '@/utils/supabase/server';
import { getProfiles } from '@/app/actions/actions';
import NewProjectForm from '@/components/NewProjectForm';
import { redirect } from 'next/navigation';
import Logo from '@/components/ui/Logo';

export default async function NewProjectPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/');

  const profiles = await getProfiles();

  return (
    <div className="min-h-screen bg-[#f5f5f7] p-8">
      <div className="max-w-2xl mx-auto">
        <header className="mb-12 flex items-center justify-between">
           <div className="flex items-center gap-4">
               <Logo className="w-10 h-10" />
               <h1 className="text-2xl font-black text-[#1d1d1f] tracking-tight">Create New Project</h1>
           </div>
        </header>

        <NewProjectForm members={profiles} />
      </div>
    </div>
  );
}
