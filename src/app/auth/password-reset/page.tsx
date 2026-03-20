import { Card, Button, Input } from '@/components/ui/components';
import Logo from '@/components/ui/Logo';
import { requestPasswordReset } from '@/app/actions/actions';
import { redirect } from 'next/navigation';
import { validateEmail, sanitizeString } from '@/utils/security';

export default function PasswordResetPage() {
    const handleReset = async (formData: FormData) => {
        "use server"
        const email = sanitizeString(formData.get('email') as string);
        if (!validateEmail(email)) {
             return redirect('/auth/password-reset?error=Invalid email address format.');
        }
        const result = await requestPasswordReset(email);
        if (result.success) {
            redirect('/?success=reset_sent');
        } else {
            redirect(`/auth/password-reset?error=${encodeURIComponent(result.error || 'Failed to send reset link')}`);
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4">
            <div className="w-full max-w-md text-center">
                <Logo className="mb-4 mx-auto" />
                <h1 className="text-2xl font-black text-[#1d1d1f] mb-2">Reset Password</h1>
                <p className="text-[#86868b] text-sm font-medium mb-8">Enter your email and we'll send you a link to reset your password.</p>
                
                <Card className="p-8 text-left">
                    <form action={handleReset} className="space-y-4">
                        <Input name="email" type="email" required placeholder="Email Address" className="w-full h-12" />
                        <Button type="submit" className="w-full h-12 text-md font-bold mt-2">Send Reset Link</Button>
                    </form>
                    <div className="mt-6 text-center">
                        <a href="/" className="text-xs font-bold text-[#86868b] hover:text-[#1d1d1f]">Back to Login</a>
                    </div>
                </Card>
            </div>
        </main>
    );
}
