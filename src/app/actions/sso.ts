"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type SSOConfig = {
    id: string;
    provider: string;
    idp_metadata_url: string | null;
    idp_entity_id: string | null;
    idp_sso_url: string | null;
    idp_certificate: string | null;
    client_id: string | null;
    client_secret: string | null;
    discovery_url: string | null;
    is_active: boolean;
};

export async function getSSOConfig(orgId: string): Promise<SSOConfig | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("org_sso")
        .select("id, provider, idp_metadata_url, idp_entity_id, idp_sso_url, idp_certificate, client_id, client_secret, discovery_url, is_active")
        .eq("org_id", orgId)
        .maybeSingle();
    return data as SSOConfig | null;
}

export async function saveSSOConfig(orgId: string, config: Partial<SSOConfig> & { provider: string }) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const payload = {
        org_id: orgId,
        configured_by: user.id,
        provider: config.provider,
        idp_metadata_url: config.idp_metadata_url ?? null,
        idp_entity_id: config.idp_entity_id ?? null,
        idp_sso_url: config.idp_sso_url ?? null,
        idp_certificate: config.idp_certificate ?? null,
        client_id: config.client_id ?? null,
        client_secret: config.client_secret ?? null,
        discovery_url: config.discovery_url ?? null,
        updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
        .from("org_sso")
        .upsert(payload, { onConflict: "org_id" });

    if (error) return { error: error.message };
    revalidatePath("/dashboard/settings/sso");
    return { ok: true };
}

export async function toggleSSO(orgId: string, isActive: boolean) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("org_sso")
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .eq("org_id", orgId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard/settings/sso");
    return { ok: true };
}
