import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getBranding } from "@/app/actions/branding";
import { BrandingSettings } from "@/components/features/BrandingSettings";

export default async function BrandingPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/");

    const { data: membership } = await supabase
        .from("organization_members")
        .select("org_id, role")
        .eq("user_id", user.id)
        .single();

    if (!membership || !["admin", "owner"].includes(membership.role)) {
        redirect("/dashboard");
    }

    const branding = await getBranding(membership.org_id);

    return (
        <div className="p-8 max-w-2xl space-y-8">
            <div>
                <h1 className="text-2xl font-black text-[#1d1d1f]">Branding</h1>
                <p className="text-sm text-slate-400 mt-1">White-label your workspace with custom colors and identity.</p>
            </div>
            <BrandingSettings orgId={membership.org_id} branding={branding} />
        </div>
    );
}
