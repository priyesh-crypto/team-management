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
    const { data, error } = await supabase
        .rpc("org_entitlement", { target_org: orgId })
        .single();

    if (error || !data) return null;
    return data as Entitlement;
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
