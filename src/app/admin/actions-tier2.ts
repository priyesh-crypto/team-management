"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requirePlatformAdmin, logAdminAction } from "@/lib/platform-admin";
import { revalidatePath } from "next/cache";

// ── Funnel analytics ───────────────────────────────────────────────────────────

export async function getFunnelData() {
    await requirePlatformAdmin();
    const admin = createAdminClient();

    const { data: orgs } = await admin
        .from("organizations")
        .select("id, subscription_status, trial_ends_at, plan_id, created_at");

    const all = orgs ?? [];
    const total = all.length;
    const trialing = all.filter(o => o.subscription_status === "trialing").length;
    const active = all.filter(o => o.subscription_status === "active").length;
    const canceled = all.filter(o => o.subscription_status === "canceled").length;
    const free = all.filter(o => o.plan_id === "free" && o.subscription_status !== "active").length;

    // Signups by day (last 30 days)
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const recent = all.filter(o => o.created_at >= since);
    const byDay: Record<string, number> = {};
    for (const o of recent) {
        const day = o.created_at.slice(0, 10);
        byDay[day] = (byDay[day] ?? 0) + 1;
    }

    return {
        total,
        trialing,
        active,
        canceled,
        free,
        trialToActiveRate: trialing + active > 0 ? Math.round((active / (trialing + active)) * 100) : 0,
        churnRate: active + canceled > 0 ? Math.round((canceled / (active + canceled)) * 100) : 0,
        signupsByDay: byDay,
    };
}

// ── Cohort retention ───────────────────────────────────────────────────────────

export async function getCohortData() {
    await requirePlatformAdmin();
    const admin = createAdminClient();

    const { data: orgs } = await admin
        .from("organizations")
        .select("id, created_at, subscription_status, plan_id")
        .order("created_at");

    const all = orgs ?? [];

    // Group by signup month
    const cohorts: Record<string, { total: number; active: number; trialing: number; canceled: number }> = {};
    for (const o of all) {
        const month = o.created_at.slice(0, 7); // "YYYY-MM"
        if (!cohorts[month]) cohorts[month] = { total: 0, active: 0, trialing: 0, canceled: 0 };
        cohorts[month].total++;
        if (o.subscription_status === "active") cohorts[month].active++;
        else if (o.subscription_status === "trialing") cohorts[month].trialing++;
        else if (o.subscription_status === "canceled") cohorts[month].canceled++;
    }

    return Object.entries(cohorts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
            month,
            ...data,
            activeRate: data.total > 0 ? Math.round((data.active / data.total) * 100) : 0,
        }));
}

// ── Broadcasts ─────────────────────────────────────────────────────────────────

export type BroadcastTarget = {
    all?: boolean;
    plans?: string[];
    min_seats?: number;
};

export async function createBroadcast(
    title: string,
    body: string,
    target: BroadcastTarget,
    channels: string[],
    sendNow: boolean
) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    if (!title.trim() || !body.trim()) throw new Error("Title and body are required.");
    if (channels.length === 0) throw new Error("Select at least one channel.");

    const { data: broadcast, error } = await admin
        .from("broadcasts")
        .insert({
            title: title.trim(),
            body: body.trim(),
            target_filter: target,
            channels,
            created_by: user.id,
            sent_at: sendNow ? new Date().toISOString() : null,
        })
        .select("id")
        .single();
    if (error || !broadcast) throw new Error(error?.message ?? "Failed to create broadcast");

    if (sendNow) {
        await _deliverBroadcast(broadcast.id, target, body, title);
    }

    await logAdminAction(user.id, "create_broadcast", null, { title, channels, sendNow });
    revalidatePath("/admin/broadcasts");
    return { id: broadcast.id };
}

async function _deliverBroadcast(
    broadcastId: string,
    target: BroadcastTarget,
    body: string,
    title: string
) {
    const admin = createAdminClient();

    // Resolve matching orgs
    let query = admin.from("organizations").select("id, plan_id, seats_purchased");
    if (!target.all && target.plans && target.plans.length > 0) {
        query = query.in("plan_id", target.plans);
    }
    const { data: orgs } = await query;
    const matchingOrgIds = (orgs ?? [])
        .filter(o => !target.min_seats || o.seats_purchased >= target.min_seats)
        .map(o => o.id);

    if (matchingOrgIds.length === 0) return;

    // Get all members of matching orgs
    const { data: members } = await admin
        .from("organization_members")
        .select("org_id, user_id")
        .in("org_id", matchingOrgIds);

    if (!members || members.length === 0) return;

    // Insert in-app notifications (batch)
    const notifications = members.map(m => ({
        org_id: m.org_id,
        user_id: m.user_id,
        type: "broadcast",
        title,
        body,
        resource_type: "broadcast",
        resource_id: broadcastId,
    }));

    // Insert deliveries (for tracking)
    const deliveries = members.map(m => ({
        broadcast_id: broadcastId,
        org_id: m.org_id,
        user_id: m.user_id,
    }));

    await Promise.all([
        admin.from("notifications").insert(notifications),
        admin.from("broadcast_deliveries").insert(deliveries),
    ]);
}

export async function getBroadcasts() {
    await requirePlatformAdmin();
    const admin = createAdminClient();

    const { data } = await admin
        .from("broadcasts")
        .select("id, title, body, target_filter, channels, sent_at, created_at")
        .order("created_at", { ascending: false });
    return data ?? [];
}

export async function getBroadcastStats(broadcastId: string) {
    await requirePlatformAdmin();
    const admin = createAdminClient();

    const [{ count: total }, { count: read }, { count: clicked }] = await Promise.all([
        admin
            .from("broadcast_deliveries")
            .select("*", { count: "exact", head: true })
            .eq("broadcast_id", broadcastId),
        admin
            .from("broadcast_deliveries")
            .select("*", { count: "exact", head: true })
            .eq("broadcast_id", broadcastId)
            .not("read_at", "is", null),
        admin
            .from("broadcast_deliveries")
            .select("*", { count: "exact", head: true })
            .eq("broadcast_id", broadcastId)
            .not("clicked_at", "is", null),
    ]);

    return { total: total ?? 0, read: read ?? 0, clicked: clicked ?? 0 };
}

export async function deleteBroadcast(broadcastId: string) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const { error } = await admin.from("broadcasts").delete().eq("id", broadcastId);
    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "delete_broadcast", null, { broadcastId });
    revalidatePath("/admin/broadcasts");
}

// ── Coupons ────────────────────────────────────────────────────────────────────

export async function createCoupon(input: {
    code: string;
    stripeCouponId?: string;
    percentOff?: number;
    amountOffCents?: number;
    currency?: string;
    validUntil?: string;
    maxRedemptions?: number;
}) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const code = input.code.trim().toUpperCase();
    if (!code) throw new Error("Coupon code is required.");
    if (!input.percentOff && !input.amountOffCents) throw new Error("Set either percent off or amount off.");
    if (input.percentOff && (input.percentOff < 1 || input.percentOff > 100)) {
        throw new Error("Percent off must be 1–100.");
    }

    const { error } = await admin.from("coupons").insert({
        code,
        stripe_coupon_id: input.stripeCouponId ?? null,
        percent_off: input.percentOff ?? null,
        amount_off_cents: input.amountOffCents ?? null,
        currency: (input.currency ?? "USD").toUpperCase(),
        valid_until: input.validUntil ?? null,
        max_redemptions: input.maxRedemptions ?? null,
        created_by: user.id,
    });
    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "create_coupon", null, { code });
    revalidatePath("/admin/coupons");
}

export async function deactivateCoupon(code: string) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const { error } = await admin.from("coupons").update({ is_active: false }).eq("code", code);
    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "deactivate_coupon", null, { code });
    revalidatePath("/admin/coupons");
}

export async function getCoupons() {
    await requirePlatformAdmin();
    const admin = createAdminClient();

    const { data } = await admin
        .from("coupons")
        .select("code, stripe_coupon_id, percent_off, amount_off_cents, currency, valid_until, max_redemptions, redemptions, is_active, created_at")
        .order("created_at", { ascending: false });
    return data ?? [];
}

export async function getCouponRedemptions(code: string) {
    await requirePlatformAdmin();
    const admin = createAdminClient();

    const { data } = await admin
        .from("coupon_redemptions")
        .select("org_id, redeemed_at, organizations(name)")
        .eq("coupon_code", code)
        .order("redeemed_at", { ascending: false });
    return (data ?? []) as unknown as Array<{
        org_id: string;
        redeemed_at: string;
        organizations: { name: string } | null;
    }>;
}

// ── Cross-org user search ──────────────────────────────────────────────────────

export async function searchUsers(query: string) {
    await requirePlatformAdmin();
    const admin = createAdminClient();

    if (!query.trim() || query.trim().length < 2) return [];

    // Search profiles by name, then look up org memberships
    const { data: profiles } = await admin
        .from("profiles")
        .select("id, full_name, avatar_url")
        .ilike("full_name", `%${query.trim()}%`)
        .limit(20);

    // Also try auth users by email if query looks like an email
    let authUserIds: string[] = [];
    if (query.includes("@")) {
        try {
            const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 50 });
            authUserIds = (authUsers?.users ?? [])
                .filter(u => u.email?.toLowerCase().includes(query.toLowerCase()))
                .map(u => u.id);
        } catch {
            // auth.admin not available in all environments
        }
    }

    const profileIds = [...new Set([...(profiles ?? []).map(p => p.id), ...authUserIds])];
    if (profileIds.length === 0) return [];

    const { data: memberships } = await admin
        .from("organization_members")
        .select("user_id, role, org_id, organizations(id, name, plan_id)")
        .in("user_id", profileIds);

    // Group by user
    const byUser: Record<string, {
        userId: string;
        name: string | null;
        orgs: { orgId: string; name: string; plan: string; role: string }[];
    }> = {};

    for (const m of memberships ?? []) {
        if (!byUser[m.user_id]) {
            const profile = (profiles ?? []).find(p => p.id === m.user_id);
            byUser[m.user_id] = { userId: m.user_id, name: profile?.full_name ?? null, orgs: [] };
        }
        const org = m.organizations as unknown as { id: string; name: string; plan_id: string } | null;
        if (org) {
            byUser[m.user_id].orgs.push({ orgId: org.id, name: org.name, plan: org.plan_id, role: m.role });
        }
    }

    return Object.values(byUser);
}
