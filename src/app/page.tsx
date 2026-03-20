import { createClient } from '@/utils/supabase/server';
import { Card, Button, Input } from '@/components/ui/components';
import Logo from '@/components/ui/Logo';
import { redirect } from 'next/navigation';

export default async function Home() {
  const supabase = await createClient();

  // 1. Check Auth 
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  let hasOrg = false;
  let orgName = '';

  if (user) {
    const { data: pData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    profile = pData;

    const { data: mData } = await supabase
      .from('organization_members')
      .select('org_id, organizations(name)')
      .eq('user_id', user.id);

    const member = mData?.[0];

    if (member) {
      hasOrg = true;
      orgName = (member.organizations as any)?.name || 'Your Workspace';
    }
  }

  // --- SERVER ACTIONS ---
  const login = async (formData: FormData) => {
    "use server"
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) redirect('/?error=invalid_credentials');
    redirect('/');
  };

  const signup = async (formData: FormData) => {
    "use server"
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const supabase = await createClient();
    
    // 1. Create user with auto-confirm using Admin API
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role: 'manager' }
    });

    if (createError) {
        // If user already exists, Supabase throws an error "User already registered"
        // We could just try to log them in, but it's safer to show the error
        console.error("Signup Data Error:", createError);
        return redirect(`/?error=signup_failed&msg=${encodeURIComponent(createError.message)}`);
    }

    // 2. Sign them in immediately to establish a session cookie
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
        console.error("Auto-login failed:", signInError);
        return redirect(`/?error=login_failed&msg=${encodeURIComponent(signInError.message)}`);
    }

    redirect('/'); // Will now route to 'Create Workspace' since they are logged in but have no org
  };

  const createOrganization = async (formData: FormData) => {
    "use server"
    const name = formData.get('orgName') as string;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect('/');

    // 1. Create Org using Service Role (since RLS might block insert if user not a member yet, though we can allow it in policies. It's safer to use admin here)
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: org, error: orgError } = await supabaseAdmin.from('organizations').insert({ name }).select('id').single();
    if (orgError || !org) {
        console.error("Org Creation Error:", orgError);
        return redirect(`/?error=org_creation_failed&msg=${encodeURIComponent(orgError?.message || '')}`);
    }

    // 2. Create Default Workspace
    const { error: wsError } = await supabaseAdmin.from('workspaces').insert({ org_id: org.id, name: 'Default Workspace' });
    if (wsError) console.error("Workspace Creation Error:", wsError);

    // 3. Add to Organization Members as Owner
    const { error: memError } = await supabaseAdmin.from('organization_members').insert({
      org_id: org.id,
      user_id: user.id,
      role: 'owner'
    });
    if (memError) console.error("Member Creation Error:", memError);

    // 4. Ensure profile exists and has manager/owner role
    // We use upsert here to guarantee the profile exists for the UI
    const { error: profError } = await supabaseAdmin.from('profiles').upsert({
        id: user.id,
        name: user.user_metadata?.name || 'New Member',
        role: 'manager'
    });
    if (profError) console.error("Profile Upsert Error:", profError);

    redirect('/');
  };

  const logout = async () => {
    "use server"
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/');
  };

  // --- RENDER UNAUTHENTICATED (LOGIN/SIGNUP) ---
  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Logo className="mb-4 escala-110" />
            <p className="text-[#86868b] text-sm font-medium">Log in or create a new workspace</p>
          </div>

          <Card className="p-8">
            <form action={login} className="space-y-4">
              <Input name="email" type="email" required placeholder="Email Address" className="w-full h-12" />
              <Input name="password" type="password" required placeholder="Password" className="w-full h-12" />
              <Button type="submit" className="w-full h-12 text-md font-bold mt-2">Sign In</Button>
            </form>

            <div className="relative my-8">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-[#e5e5ea]" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-[#86868b] font-bold">Or create an account</span></div>
            </div>

            <form action={signup} className="space-y-4">
              <Input name="name" type="text" required placeholder="Full Name" className="w-full h-12" />
              <Input name="email" type="email" required placeholder="Work Email" className="w-full h-12" />
              <Input name="password" type="password" required placeholder="Choose Password" className="w-full h-12" />
              <Button type="submit" variant="secondary" className="w-full h-12 text-md font-bold mt-2 border-2">Sign Up for SaaS</Button>
            </form>
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
            <Card className="p-8 border-2 border-[#0071e3]/20 shadow-xl shadow-[#0071e3]/10">
              <form action={createOrganization} className="space-y-6">
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-[#86868b] mb-3 ml-2">Company Name</label>
                  <Input name="orgName" required placeholder="Acme Corp" className="w-full h-14 text-lg font-bold px-6 rounded-2xl bg-[#f5f5f7] border-none" />
                </div>
                <Button type="submit" className="w-full h-14 text-lg font-black tracking-wide rounded-2xl mt-4 bg-[#0071e3] hover:bg-[#0077ED] shadow-lg shadow-[#0071e3]/30">Launch Workspace</Button>
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
