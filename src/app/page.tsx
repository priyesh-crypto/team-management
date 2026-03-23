import { createClient } from '@/utils/supabase/server';
import { Card, Button, Input } from '@/components/ui/components';
import Logo from '@/components/ui/Logo';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { checkActionRateLimit } from '@/utils/rate-limit';
import { sanitizeString, validateEmail, validatePasswordStrength } from '@/utils/security';

export default async function Home({ searchParams }: { searchParams: { error?: string, success?: string, msg?: string } }) {
  const supabase = await createClient();

  // 1. Check Auth 
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  let hasOrg = false;
  let orgName = '';

  if (user) {
    // Parallelize profile and org checks for logged-in users
    const [profileRes, memberRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('organization_members')
        .select('org_id, organizations(name)')
        .eq('user_id', user.id)
    ]);

    profile = profileRes.data;
    const member = memberRes.data?.[0];

    if (member) {
      hasOrg = true;
      orgName = (member.organizations as any)?.name || 'Your Workspace';
    }
  }

  // --- SERVER ACTIONS ---
  const login = async (formData: FormData) => {
    "use server"
    const email = sanitizeString(formData.get('email') as string);
    const password = formData.get('password') as string;
    
    if (!validateEmail(email)) return redirect('/?error=invalid_credentials');
    
    const supabase = await createClient();

    // Rate Limiting: 10 attempts per 15 minutes per IP/Email
    const ip = (await headers()).get('x-forwarded-for') || 'unknown';
    const throttle = await checkActionRateLimit(`${ip}:${email}`, 'login', 10, 15 * 60 * 1000);
    if (!throttle.allowed) return redirect(`/?error=rate_limited&msg=${encodeURIComponent(throttle.error || '')}`);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
        if (error.message.includes('Email not confirmed')) {
            return redirect('/?error=email_not_verified');
        }
        return redirect('/?error=invalid_credentials');
    }
    // Direct redirect to dashboard skip the Home render cycle
    redirect('/dashboard');
  };

  const signup = async (formData: FormData) => {
    "use server"
    const name = sanitizeString(formData.get('name') as string);
    const email = sanitizeString(formData.get('email') as string);
    const password = formData.get('password') as string;

    if (!name || name.length < 2) return redirect('/?error=signup_failed&msg=Name is too short.');
    if (!validateEmail(email)) return redirect('/?error=signup_failed&msg=Invalid email format.');
    if (!validatePasswordStrength(password)) return redirect('/?error=signup_failed&msg=Password must be at least 8 characters with mixed case and numbers.');

    const supabase = await createClient();
    
    // Rate Limiting: 3 signups per hour per IP
    const ip = (await headers()).get('x-forwarded-for') || 'unknown';
    const throttle = await checkActionRateLimit(ip, 'signup', 3, 60 * 60 * 1000);
    if (!throttle.allowed) return redirect(`/?error=rate_limited&msg=${encodeURIComponent(throttle.error || '')}`);

    // Use standard signUp - this automatically handles email verification
    // and built-in Supabase rate limiting for signups.
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { name, role: 'manager' },
            emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`
        }
    });

    if (error) {
        console.error("Signup Error:", error);
        return redirect(`/?error=signup_failed&msg=${encodeURIComponent(error.message)}`);
    }

    // If user is returned but has no session, it means email verification is required
    if (data.user && !data.session) {
        return redirect('/?success=signup_pending');
    }

    redirect('/');
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
        email: user.email,
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
            {/* Feedback Messages */}
            {(() => {
              const errorType = searchParams.error;
              const successType = searchParams.success;
              const customMsg = searchParams.msg;

              const configs: Record<string, { msg: string, type: 'error' | 'success' }> = {
                invalid_credentials: { msg: 'Invalid email or password.', type: 'error' },
                email_not_verified: { msg: 'Please verify your email before logging in.', type: 'error' },
                rate_limited: { msg: 'Too many attempts. Please try again later.', type: 'error' },
                signup_failed: { msg: 'Signup failed. Please try again.', type: 'error' },
                signup_pending: { msg: 'Please check your email to verify your account.', type: 'success' },
                reset_sent: { msg: 'Password reset link sent to your email.', type: 'success' },
                password_updated: { msg: 'Password updated successfully. Please log in.', type: 'success' },
                bot_detected: { msg: 'Security check failed. Please try again.', type: 'error' }
              };

              const active = (errorType && configs[errorType]) || (successType && configs[successType]);
              if (!active) return null;

              return (
                <div className={`p-3 rounded-lg text-sm font-bold mb-6 ${active.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'}`}>
                  {customMsg || active.msg}
                </div>
              );
            })()}

            <form action={async (fd) => {
              "use server"
              // Honeypot check
              if (fd.get('website')) return redirect('/?error=bot_detected');
              return login(fd);
            }} className="space-y-4">
              {/* Honeypot field - hidden from users, but often filled by bots */}
              <div className="hidden" aria-hidden="true">
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </div>
              <Input name="email" type="email" required placeholder="Email Address" className="w-full h-12" />
              <Input name="password" type="password" required placeholder="Password" className="w-full h-12" />
              <div className="flex justify-end">
                <a href="/auth/password-reset" className="text-xs font-bold text-[#0071e3] hover:underline">Forgot password?</a>
              </div>
              <Button type="submit" className="w-full h-12 text-md font-bold mt-2">Sign In</Button>
            </form>

            <div className="relative my-8">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-[#e5e5ea]" /></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-[#86868b] font-bold">Or create an account</span></div>
            </div>

            <form action={async (fd) => {
              "use server"
              // Honeypot check
              if (fd.get('website')) return redirect('/?error=bot_detected');
              return signup(fd);
            }} className="space-y-4">
              {/* Honeypot field */}
              <div className="hidden" aria-hidden="true">
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </div>
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
