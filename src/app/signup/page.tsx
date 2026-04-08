import { createClient } from '@/utils/supabase/server';
import { Card, Button, Input } from '@/components/ui/components';
import Logo from '@/components/ui/Logo';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { checkActionRateLimit } from '@/utils/rate-limit';
import { sanitizeString, validateEmail, validatePasswordStrength } from '@/utils/security';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string; msg?: string };
}) {
  // Already authenticated — no need to be here
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/');

  const signup = async (formData: FormData) => {
    'use server';
    if (formData.get('website')) return redirect('/signup?error=bot_detected');

    const name     = sanitizeString(formData.get('name') as string);
    const email    = sanitizeString(formData.get('email') as string);
    const password = formData.get('password') as string;

    if (!name || name.length < 2)
      return redirect('/signup?error=validation&msg=Name+is+too+short.');
    if (!validateEmail(email))
      return redirect('/signup?error=validation&msg=Invalid+email+format.');
    if (!validatePasswordStrength(password))
      return redirect(
        '/signup?error=validation&msg=Password+must+be+at+least+8+characters+with+mixed+case+and+numbers.'
      );

    const supabase = await createClient();

    // Rate limit: 3 signups per hour per IP
    const ip = (await headers()).get('x-forwarded-for') || 'unknown';
    const throttle = await checkActionRateLimit(ip, 'signup', 3, 60 * 60 * 1000);
    if (!throttle.allowed)
      return redirect(
        `/signup?error=rate_limited&msg=${encodeURIComponent(throttle.error || 'Too many attempts. Try again later.')}`
      );

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role: 'manager' },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      },
    });

    if (error) {
      console.error('[Signup]', error.message);
      return redirect(`/signup?error=signup_failed&msg=${encodeURIComponent(error.message)}`);
    }

    // Email verification required — send user to login page with success banner
    if (data.user && !data.session) {
      return redirect('/?success=signup_pending');
    }

    redirect('/');
  };

  const errorConfigs: Record<string, string> = {
    bot_detected:  'Security check failed. Please try again.',
    validation:    '',
    signup_failed: '',
    rate_limited:  '',
  };

  const errorMsg = searchParams.error
    ? (searchParams.msg ? decodeURIComponent(searchParams.msg) : (errorConfigs[searchParams.error] ?? 'Something went wrong.'))
    : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo className="mb-4 escala-110" />
          <h1 className="text-2xl font-black text-[#1d1d1f] tracking-tight">Create your account</h1>
          <p className="text-[#86868b] text-sm font-medium mt-1">Start managing your team&apos;s work</p>
        </div>

        <Card className="p-8">
          {errorMsg && (
            <div className="p-3 rounded-lg text-sm font-bold mb-6 bg-red-50 text-red-600 border border-red-100">
              {errorMsg}
            </div>
          )}

          <form action={signup} className="space-y-4">
            {/* Honeypot */}
            <div className="hidden" aria-hidden="true">
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </div>

            <Input name="name"     type="text"     required placeholder="Full Name"      className="w-full h-12" />
            <Input name="email"    type="email"    required placeholder="Work Email"     className="w-full h-12" />
            <Input name="password" type="password" required placeholder="Choose Password" className="w-full h-12" />

            <Button type="submit" className="w-full h-12 text-md font-bold mt-2">
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-[#86868b] font-medium">
            Already have an account?{' '}
            <a href="/" className="font-black text-[#0c64ef] hover:underline">Sign in</a>
          </p>
        </Card>
      </div>
    </main>
  );
}
