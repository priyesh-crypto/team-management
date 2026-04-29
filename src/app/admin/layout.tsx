import { redirect } from "next/navigation";
import Link from "next/link";
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
                <div className="bg-white rounded-[32px] border border-[#e5e5ea] p-12 text-center max-w-md shadow-sm">
                    <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[#fee2e2] flex items-center justify-center text-3xl">
                        🔒
                    </div>
                    <h1 className="text-xl font-black tracking-tight text-[#1d1d1f]">
                        Platform admin only
                    </h1>
                    <p className="mt-2 text-sm text-[#86868b] font-medium">
                        You don&apos;t have access to this area.
                    </p>
                    <Link
                        href="/dashboard"
                        className="mt-6 inline-block px-5 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-[10px] font-black uppercase tracking-widest hover:bg-[#0c64ef] transition"
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
            <main className="flex-1 ml-60 min-h-screen">{children}</main>
        </div>
    );
}
