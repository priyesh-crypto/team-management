import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getCustomRoles } from "@/app/actions/custom-roles";
import { CustomRolesManager } from "@/components/features/CustomRolesManager";

export default async function RolesPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/");

    const { data: membership } = await supabase
        .from("organization_members")
        .select("org_id, role")
        .eq("user_id", user.id)
        .maybeSingle();

    if (!membership || !["admin", "owner"].includes(membership.role)) {
        redirect("/dashboard");
    }

    const roles = await getCustomRoles(membership.org_id);

    return (
        <div className="p-8 max-w-3xl space-y-8">
            <div>
                <h1 className="text-2xl font-black text-[#1d1d1f]">Custom Roles</h1>
                <p className="text-sm text-slate-400 mt-1">Define permission sets beyond the built-in member roles.</p>
            </div>
            <CustomRolesManager orgId={membership.org_id} roles={roles} />
        </div>
    );
}
