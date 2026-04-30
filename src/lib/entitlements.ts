import { createClient } from "@/utils/supabase/server";

export type Entitlement = {
    plan_id: string;
    subscription_status: string | null;
    seat_limit: number | null;
    project_limit: number | null;
    seats_used: number;
    projects_used: number;
    features: Record<string, boolean>;
    is_active: boolean;
};

export async function getEntitlement(orgId: string): Promise<Entitlement | null> {
    const supabase = await createClient();

    // Always fetch the base entitlement.
    const { data, error } = await supabase
        .rpc("org_entitlement", { target_org: orgId })
        .single();
    if (error || !data) return null;
    const entitlement = data as Entitlement;

    // org_feature_overrides is admin_tier1; if that migration isn't applied
    // the SELECT errors. Swallow it silently — features fall back to plan defaults.
    try {
        const { data: overrides } = await supabase
            .from("org_feature_overrides")
            .select("feature_key, enabled")
            .eq("org_id", orgId);
        for (const o of overrides ?? []) {
            entitlement.features[o.feature_key] = o.enabled;
        }
    } catch {
        // table missing — ignore
    }

    return entitlement;
}

export function canAddSeat(e: Entitlement): { ok: boolean; reason?: string } {
    if (!e.is_active) return { ok: false, reason: "Subscription inactive" };
    if (e.seat_limit !== null && e.seats_used >= e.seat_limit) {
        return { ok: false, reason: `Seat limit reached (${e.seat_limit})` };
    }
    return { ok: true };
}

export function canCreateProject(e: Entitlement): { ok: boolean; reason?: string } {
    if (!e.is_active) return { ok: false, reason: "Subscription inactive" };
    if (e.project_limit !== null && e.projects_used >= e.project_limit) {
        return { ok: false, reason: `Project limit reached (${e.project_limit})` };
    }
    return { ok: true };
}

export function hasFeature(e: Entitlement, feature: string): boolean {
    return e.is_active && Boolean(e.features?.[feature]);
}
