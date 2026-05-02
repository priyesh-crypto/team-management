import { redirect } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { AdminNav } from "./_components/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    if (!isAdmin) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
                <div className="bg-white rounded-xl border border-[#e5e5ea] p-8 text-center max-w-sm shadow-sm">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-lg bg-[#fee2e2] flex items-center justify-center text-[#dc2626]">
                        <Lock size={20} strokeWidth={2} />
                    </div>
                    <h1 className="text-lg font-semibold text-[#1d1d1f]">
                        Platform admin only
                    </h1>
                    <p className="mt-1.5 text-sm text-[#86868b]">
                        You don&apos;t have access to this area.
                    </p>
                    <Link
                        href="/dashboard"
                        className="mt-5 inline-block px-4 py-2 rounded-md bg-[#1d1d1f] text-white text-xs font-medium hover:bg-[#0c64ef] transition-colors"
                    >
                        Back to dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex">
            <AdminNav userEmail={user.email ?? ""} />
            <main className="flex-1 ml-56 min-h-screen">{children}</main>
        </div>
    );
}
