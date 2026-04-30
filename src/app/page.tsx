import { createClient } from '@/utils/supabase/server';
import { Card, Button, Input } from '@/components/ui/components';
import Logo from '@/components/ui/Logo';
import UrlToaster from '@/components/ui/UrlToaster';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { checkActionRateLimit } from '@/utils/rate-limit';

export default async function Home({ searchParams }: { searchParams: { error?: string, success?: string, msg?: string } }) {
  const supabase = await createClient();

  // 1. Check Auth 
  const { data: { user } } = await supabase.auth.getUser();

  let hasOrg = false;

  if (user) {
    const { data: members } = await supabase
      .from('organization_members')
      .select('org_id')
      .eq('user_id', user.id)
      .limit(1);
    hasOrg = (members?.length ?? 0) > 0;
  }

  // --- SERVER ACTIONS ---
  const login = async (formData: FormData) => {
    "use server"
    const email = (formData.get('email') as string)?.trim().toLowerCase();
    const password = formData.get('password') as string;

    if (!email || !password) return redirect('/?error=invalid_credentials&details=Missing%20credentials');

    const supabase = await createClient();

    // Rate Limiting: 50 attempts per 15 minutes per IP/Email
    const ip = (await headers()).get('x-forwarded-for') || 'unknown';
    const throttle = await checkActionRateLimit(`${ip}:${email}`, 'login', 50, 15 * 60 * 1000);
    if (!throttle.allowed) return redirect(`/?error=rate_limited&msg=${encodeURIComponent(throttle.error || '')}`);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error("[Login] Auth Error for", email, ":", error.message, error.status);
      if (error.message.includes('Email not confirmed')) {
        return redirect('/?error=email_not_verified');
      }
      return redirect(`/?error=invalid_credentials&details=${encodeURIComponent(error.message)}`);
    }
    // Direct redirect to dashboard skip the Home render cycle
    redirect('/dashboard');
  };

  const createOrganization = async (formData: FormData) => {
    "use server"
    const name = formData.get('orgName') as string;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect('/');

    // 1. Create Org using Service Role
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: org, error: orgError } = await supabaseAdmin.from('organizations').insert({ name }).select('id').single();
    if (orgError || !org) {
      console.error("Org Creation Error:", orgError);
      return redirect(`/?error=org_creation_failed&msg=${encodeURIComponent(orgError?.message || '')}`);
    }

    // 2. Create Default Workspace
    const { error: wsError } = await supabaseAdmin.from('workspaces').insert({ org_id: org.id, name: 'Default Workspace' });
    if (wsError) {
      console.error("Workspace Creation Error:", wsError);
      return redirect(`/?error=org_creation_failed&msg=${encodeURIComponent('Workspace setup failed: ' + wsError.message)}`);
    }

    // 3. Add to Organization Members as Owner
    const { error: memError } = await supabaseAdmin.from('organization_members').insert({
      org_id: org.id,
      user_id: user.id,
      role: 'owner'
    });
    if (memError) {
      console.error("Member Creation Error:", memError);
      return redirect(`/?error=org_creation_failed&msg=${encodeURIComponent('Member setup failed: ' + memError.message)}`);
    }

    // 4. Ensure profile exists and has manager/owner role
    // We use upsert here to guarantee the profile exists for the UI
    const { error: profError } = await supabaseAdmin.from('profiles').upsert({
      id: user.id,
      name: user.user_metadata?.name || 'New Member',
      email: user.email,
      role: 'manager'
    });
    if (profError) {
      console.error("Profile Upsert Error:", profError);
      return redirect(`/?error=org_creation_failed&msg=${encodeURIComponent('Profile setup failed: ' + profError.message)}`);
    }

    redirect('/');
  };

  const logout = async () => {
    "use server"
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/');
  };

  // --- RENDER UNAUTHENTICATED (LOGIN) ---
  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Logo className="mb-4 escala-110" />
            <p className="text-[#86868b] text-sm font-medium">Sign in to your workspace</p>
          </div>

          <Card className="p-8">
            {/* Feedback Messages */}
            <UrlToaster error={searchParams.error} success={searchParams.success} msg={searchParams.msg} />

            <form action={async (fd) => {
              "use server"
              if (fd.get('website')) return redirect('/?error=bot_detected');
              return login(fd);
            }} className="space-y-4">
              {/* Honeypot field */}
              <div className="hidden" aria-hidden="true">
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <Input name="email" type="email" required placeholder="Email Address" className="w-full h-12" />
              <Input name="password" type="password" required placeholder="Password" className="w-full h-12" />
              <div className="flex justify-end">
                <a href="/auth/password-reset" className="text-xs font-bold text-[#0c64ef] hover:underline">Forgot password?</a>
              </div>
              <Button type="submit" className="w-full h-12 text-md font-bold mt-2">Sign In</Button>
            </form>

            <p className="mt-6 text-center text-xs text-[#86868b] font-medium">
              Don&apos;t have an account?{' '}
              <a href="/signup" className="font-black text-[#0c64ef] hover:underline">Create one</a>
            </p>
          </Card>
        </div>
      </main>
    );
  }

  // --- RENDER ONBOARDING (LOGGED IN BUT NO ORG) ---
  if (!hasOrg) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-[#f5f5f7]">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Logo className="mb-4 escala-110" />
            <h1 className="text-2xl font-black text-[#1d1d1f] tracking-tight">Create Your Workspace</h1>
            <p className="text-[#86868b] text-sm font-medium mt-2">Set up your company to start managing tasks</p>
          </div>
          <Card className="p-8 border-2 border-[#0c64ef]/20 shadow-xl shadow-[#0c64ef]/10">
            <form action={createOrganization} className="space-y-6">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-[#86868b] mb-3 ml-2">Company Name</label>
                <Input name="orgName" required placeholder="Acme Corp" className="w-full h-14 text-lg font-bold px-6 rounded-2xl bg-[#f5f5f7] border-none" />
              </div>
              <Button type="submit" className="w-full h-14 text-lg font-black tracking-wide rounded-2xl mt-4 bg-[#0c64ef] hover:bg-[#1a6a90] shadow-lg shadow-[#0c64ef]/30">Launch Workspace</Button>
            </form>

            <form action={logout} className="mt-6 text-center">
              <button type="submit" className="text-xs font-bold text-[#86868b] hover:text-[#1d1d1f] transition-colors">Sign out instead</button>
            </form>
          </Card>
        </div>
      </main>
    );
  }

  // --- RENDER AUTHENTICATED DASHBOARDS ---
  if (user && hasOrg) {
    redirect('/dashboard');
  }

  // Fallback for onboarding handled above
  return null;
}
