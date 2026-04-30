import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { DataExportButton } from "@/components/features/DataExportButton";

export default async function ExportPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/");

    const { data: membership } = await supabase
        .from("organization_members")
        .select("org_id, role")
        .eq("user_id", user.id)
        .single();

    if (!membership || !["manager", "admin", "owner"].includes(membership.role)) {
        redirect("/dashboard");
    }

    return (
        <div className="p-8 max-w-2xl space-y-8">
            <div>
                <h1 className="text-2xl font-black text-[#1d1d1f]">Data Export</h1>
                <p className="text-sm text-slate-400 mt-1">Download your organization data for backup or migration.</p>
            </div>
            <DataExportButton />
        </div>
    );
}
