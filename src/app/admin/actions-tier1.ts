"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requirePlatformAdmin, logAdminAction } from "@/lib/platform-admin";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

// ── Suspend / unsuspend ────────────────────────────────────────────────────────

export async function suspendOrg(orgId: string, reason: string) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    if (!reason.trim()) throw new Error("A suspension reason is required.");

    const { error } = await admin
        .from("organizations")
        .update({ suspended_at: new Date().toISOString(), suspended_reason: reason.trim() })
        .eq("id", orgId);
    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "suspend_org", orgId, { reason });
    revalidatePath(`/admin/orgs/${orgId}`);
}

export async function unsuspendOrg(orgId: string) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const { error } = await admin
        .from("organizations")
        .update({ suspended_at: null, suspended_reason: null })
        .eq("id", orgId);
    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "unsuspend_org", orgId, {});
    revalidatePath(`/admin/orgs/${orgId}`);
}

// ── Credits ────────────────────────────────────────────────────────────────────

export async function issueCredit(
    orgId: string,
    amountCents: number,
    currency: string,
    reason: string
) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    if (amountCents <= 0) throw new Error("Amount must be greater than zero.");
    if (!reason.trim()) throw new Error("A reason is required.");

    const { error } = await admin.from("org_credits").insert({
        org_id: orgId,
        amount_cents: amountCents,
        currency: currency.toUpperCase(),
        reason: reason.trim(),
        created_by: user.id,
    });
    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "issue_credit", orgId, { amountCents, currency, reason });
    revalidatePath(`/admin/orgs/${orgId}`);
}

export async function getOrgCredits(orgId: string) {
    await requirePlatformAdmin();
    const admin = createAdminClient();

    const { data } = await admin
        .from("org_credits")
        .select("id, amount_cents, currency, reason, created_at, applied_at")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
    return data ?? [];
}

// ── Feature overrides ──────────────────────────────────────────────────────────

export async function setFeatureOverride(
    orgId: string,
    featureKey: string,
    enabled: boolean
) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const { error } = await admin.from("org_feature_overrides").upsert(
        {
            org_id: orgId,
            feature_key: featureKey,
            enabled,
            updated_by: user.id,
            updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,feature_key" }
    );
    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "set_feature_override", orgId, { featureKey, enabled });
    revalidatePath(`/admin/orgs/${orgId}`);
    revalidatePath("/admin/feature-flags");
}

export async function clearFeatureOverride(orgId: string, featureKey: string) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const { error } = await admin
        .from("org_feature_overrides")
        .delete()
        .eq("org_id", orgId)
        .eq("feature_key", featureKey);
    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "clear_feature_override", orgId, { featureKey });
    revalidatePath(`/admin/orgs/${orgId}`);
    revalidatePath("/admin/feature-flags");
}

export async function getFeatureOverrides(orgId: string) {
    await requirePlatformAdmin();
    const admin = createAdminClient();

    const { data } = await admin
        .from("org_feature_overrides")
        .select("feature_key, enabled, updated_at")
        .eq("org_id", orgId);
    return data ?? [];
}

export async function getAllFeatureOverrides() {
    await requirePlatformAdmin();
    const admin = createAdminClient();

    const { data } = await admin
        .from("org_feature_overrides")
        .select("org_id, feature_key, enabled, updated_at, organizations(name)")
        .order("updated_at", { ascending: false });
    return (data ?? []) as unknown as Array<{
        org_id: string;
        feature_key: string;
        enabled: boolean;
        updated_at: string;
        organizations: { name: string } | null;
    }>;
}

// ── Impersonation ──────────────────────────────────────────────────────────────

export async function startImpersonation(orgId: string) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const { data, error } = await admin
        .from("impersonation_sessions")
        .insert({ admin_user_id: user.id, target_org_id: orgId })
        .select("id")
        .single();
    if (error || !data) throw new Error(error?.message ?? "Failed to create impersonation session");

    await logAdminAction(user.id, "start_impersonation", orgId, { sessionId: data.id });

    const cookieStore = await cookies();
    cookieStore.set("__impersonate", data.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 3600,
    });

    return { sessionId: data.id };
}

export async function endImpersonation() {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("__impersonate")?.value;

    if (sessionId) {
        const admin = createAdminClient();
        await admin
            .from("impersonation_sessions")
            .update({ ended_at: new Date().toISOString() })
            .eq("id", sessionId)
            .is("ended_at", null);
    }

    cookieStore.delete("__impersonate");
}

// ── Usage / activity stats ─────────────────────────────────────────────────────

export async function getOrgActivity(orgId: string, days = 30) {
    await requirePlatformAdmin();
    const admin = createAdminClient();

    const since = new Date(Date.now() - days * 86400000).toISOString();

    const [
        { data: tasks },
        { count: memberCount },
        { data: comments },
    ] = await Promise.all([
        admin
            .from("tasks")
            .select("created_at, status, priority")
            .eq("org_id", orgId)
            .gte("created_at", since)
            .order("created_at"),
        admin
            .from("organization_members")
            .select("*", { count: "exact", head: true })
            .eq("org_id", orgId),
        admin
            .from("task_comments")
            .select("created_at")
            .eq("org_id", orgId)
            .gte("created_at", since),
    ]);

    // Bucket tasks by day
    const byDay: Record<string, { created: number; completed: number; comments: number }> = {};

    for (const t of tasks ?? []) {
        const day = t.created_at.slice(0, 10);
        if (!byDay[day]) byDay[day] = { created: 0, completed: 0, comments: 0 };
        byDay[day].created++;
        if (t.status === "done" || t.status === "completed") byDay[day].completed++;
    }
    for (const c of comments ?? []) {
        const day = c.created_at.slice(0, 10);
        if (!byDay[day]) byDay[day] = { created: 0, completed: 0, comments: 0 };
        byDay[day].comments++;
    }

    const priorityCounts: Record<string, number> = {};
    for (const t of tasks ?? []) {
        const p = t.priority ?? "none";
        priorityCounts[p] = (priorityCounts[p] ?? 0) + 1;
    }

    return {
        byDay,
        totalMembers: memberCount ?? 0,
        taskCount: tasks?.length ?? 0,
        commentCount: comments?.length ?? 0,
        priorityCounts,
    };
}
