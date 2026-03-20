import { Card, Button, Input } from '@/components/ui/components';
import Logo from '@/components/ui/Logo';
import { updateOwnPassword } from '@/app/actions/actions';
import { redirect } from 'next/navigation';
import { validatePasswordStrength } from '@/utils/security';

export default function UpdatePasswordPage() {
    const handleUpdate = async (formData: FormData) => {
        "use server"
        const password = formData.get('password') as string;
        if (!validatePasswordStrength(password)) {
            return redirect('/auth/update-password?error=Password does not meet strength requirements (min 8 chars, mixed case, and numbers).');
        }
        try {
            await updateOwnPassword(password);
            redirect('/?success=password_updated');
        } catch (error: any) {
            redirect(`/auth/update-password?error=${encodeURIComponent(error.message || 'Failed to update password')}`);
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4">
            <div className="w-full max-w-md text-center">
                <Logo className="mb-4 mx-auto" />
                <h1 className="text-2xl font-black text-[#1d1d1f] mb-2">New Password</h1>
                <p className="text-[#86868b] text-sm font-medium mb-8">Please choose a new secure password.</p>
                
                <Card className="p-8 text-left">
                    <form action={handleUpdate} className="space-y-4">
                        <Input name="password" type="password" required placeholder="New Password" className="w-full h-12" />
                        <Button type="submit" className="w-full h-12 text-md font-bold mt-2">Update Password</Button>
                    </form>
                </Card>
            </div>
        </main>
    );
}
