import { createClient } from '@/utils/supabase/server';
import EmployeeDashboard from '@/components/EmployeeDashboard';
import ManagerDashboard from '@/components/ManagerDashboard';
import { Card, Button, Input } from '@/components/ui/components';
import Logo from '@/components/ui/Logo';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = await createClient();

  // 1. Check if the user is already authenticated
  const { data: { user } } = await supabase.auth.getUser();

  // 2. We need their profile role to know which Dashboard to show
  let profile = null;
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = data;
  }

  // --- SERVER ACTION: Login ---
  const login = async (formData: FormData) => {
    "use server"
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      redirect('/?error=invalid_credentials');
    }

    redirect('/');
  };

  // --- SERVER ACTION: Logout ---
  const logout = async () => {
    "use server"
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/');
  };

  // --- RENDER UNAUTHENTICATED ---
  if (!user || !profile) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Logo className="mb-4 escala-110" />
            <p className="text-[#86868b] text-sm font-medium">Sign in to your organization</p>
          </div>

          <Card>
            <form action={login} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold mb-2 text-[#1d1d1f]">
                  Email Address
                </label>
                <Input
                  name="email"
                  type="email"
                  required
                  placeholder="name@company.com"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2 text-[#1d1d1f]">
                  Password
                </label>
                <Input
                  name="password"
                  type="password"
                  required
                  placeholder="Enter your password"
                  className="w-full"
                />
              </div>

              {/* In a real app, handle the ?error query param here */}

              <Button type="submit" className="w-full py-3 text-lg">
                Sign In
              </Button>
            </form>
          </Card>
        </div>
      </main>
    );
  }

  // --- RENDER AUTHENTICATED ---
  return (
    <div className="min-h-screen p-4 md:p-8">
      <header className="max-w-7xl mx-auto mb-8 flex justify-between items-center bg-white/80 backdrop-blur-md rounded-2xl p-4 sticky top-4 z-50 shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-[#e5e5ea]">
        <div className="flex items-center gap-4">
          <Logo showText={false} className="w-8 h-8" />
          <div className="h-8 w-px bg-[#e5e5ea]" />
          <div>
            <h1 className="text-lg font-bold leading-none text-[#1d1d1f]">
              Team Management
            </h1>
            <span className="text-[10px] text-[#86868b] uppercase tracking-widest font-bold">
              {profile.role} portal
            </span>
          </div>
        </div>

        <form action={logout}>
          <Button variant="secondary" type="submit" className="text-sm">
            Sign Out
          </Button>
        </form>
      </header>

      <main className="max-w-7xl mx-auto pb-20 fade-in">
        {profile.role === 'employee' ? (
          <EmployeeDashboard userId={user.id} userName={profile.name} />
        ) : (
          <ManagerDashboard userId={user.id} userName={profile.name} />
        )}
      </main>
    </div>
  );
}
