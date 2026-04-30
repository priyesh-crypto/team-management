"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type OrgBranding = {
    id?: string;
    logo_url: string | null;
    favicon_url: string | null;
    primary_color: string;
    accent_color: string;
    org_display_name: string | null;
    custom_domain: string | null;
    support_email: string | null;
};

export async function getBranding(orgId: string): Promise<OrgBranding | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("org_branding")
        .select("id, logo_url, favicon_url, primary_color, accent_color, org_display_name, custom_domain, support_email")
        .eq("org_id", orgId)
        .maybeSingle();
    return data as OrgBranding | null;
}

export async function saveBranding(orgId: string, branding: Partial<OrgBranding>) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const payload = {
        org_id: orgId,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
        logo_url: branding.logo_url ?? null,
        favicon_url: branding.favicon_url ?? null,
        primary_color: branding.primary_color ?? "#0c64ef",
        accent_color: branding.accent_color ?? "#34c759",
        org_display_name: branding.org_display_name ?? null,
        custom_domain: branding.custom_domain ?? null,
        support_email: branding.support_email ?? null,
    };

    const { error } = await supabase
        .from("org_branding")
        .upsert(payload, { onConflict: "org_id" });

    if (error) return { error: error.message };
    revalidatePath("/dashboard/settings/branding");
    return { ok: true };
}
