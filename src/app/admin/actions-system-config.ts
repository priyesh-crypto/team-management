"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requirePlatformAdmin, logAdminAction } from "@/lib/platform-admin";
import { revalidatePath } from "next/cache";

export type ConfigEntry = {
    key: string;
    value: string;
    type: "string" | "number" | "boolean" | "json";
    description: string | null;
    updated_at: string;
};

export type ContentPage = {
    slug: string;
    title: string;
    body_md: string;
    updated_at: string;
};

// ── System Config ─────────────────────────────────────────────────────────────

export async function getSystemConfig(): Promise<ConfigEntry[]> {
    await requirePlatformAdmin();
    const admin = createAdminClient();
    const { data } = await admin
        .from("system_config")
        .select("key, value, type, description, updated_at")
        .order("key");
    return (data ?? []) as ConfigEntry[];
}

export async function updateSystemConfig(key: string, value: string) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const { error } = await admin
        .from("system_config")
        .update({ value, updated_by: user.id, updated_at: new Date().toISOString() })
        .eq("key", key);

    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "update_system_config", null, { key, value });
    revalidatePath("/admin/system-config");
}

// ── Content Pages ─────────────────────────────────────────────────────────────

export async function getContentPages(): Promise<ContentPage[]> {
    await requirePlatformAdmin();
    const admin = createAdminClient();
    const { data } = await admin
        .from("content_pages")
        .select("slug, title, body_md, updated_at")
        .order("slug");
    return (data ?? []) as ContentPage[];
}

export async function getContentPage(slug: string): Promise<ContentPage | null> {
    // Public — no admin check needed
    const admin = createAdminClient();
    const { data } = await admin
        .from("content_pages")
        .select("slug, title, body_md, updated_at")
        .eq("slug", slug)
        .single();
    return data as ContentPage | null;
}

export async function upsertContentPage(slug: string, title: string, bodyMd: string) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const { error } = await admin.from("content_pages").upsert({
        slug,
        title: title.trim(),
        body_md: bodyMd,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
    });

    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "upsert_content_page", null, { slug, title });
    revalidatePath("/admin/content");
    revalidatePath(`/${slug}`);
}

// ── Broadcast Banner ──────────────────────────────────────────────────────────

export async function getActiveBanner() {
    // Called from user dashboards — no admin check
    const admin = createAdminClient();
    const { data } = await admin
        .from("broadcasts")
        .select("id, title, body")
        .eq("is_pinned_banner", true)
        .not("sent_at", "is", null)
        .limit(1)
        .maybeSingle();
    return data as { id: string; title: string; body: string } | null;
}

export async function pinBroadcastAsBanner(broadcastId: string) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    // Unpin any currently pinned broadcast first
    await admin.from("broadcasts").update({ is_pinned_banner: false }).eq("is_pinned_banner", true);

    const { error } = await admin
        .from("broadcasts")
        .update({ is_pinned_banner: true })
        .eq("id", broadcastId);

    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "pin_broadcast_banner", null, { broadcastId });
    revalidatePath("/admin/broadcasts");
}

export async function unpinBanner() {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    await admin.from("broadcasts").update({ is_pinned_banner: false }).eq("is_pinned_banner", true);

    await logAdminAction(user.id, "unpin_broadcast_banner", null, {});
    revalidatePath("/admin/broadcasts");
}

// ── DB Maintenance ────────────────────────────────────────────────────────────

export async function refreshWorkloadView() {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const { error } = await admin.rpc("refresh_workload_summary" as any);
    if (error) throw new Error(error.message);

    await logAdminAction(user.id, "refresh_workload_view", null, {});
    revalidatePath("/admin/system");
    return { refreshedAt: new Date().toISOString() };
}

export async function recalcOrgUsage(orgId?: string) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    // Recount seats from organization_members for each org (or a specific one)
    const query = admin
        .from("organization_members")
        .select("org_id, count:user_id.count()");

    if (orgId) (query as any).eq("org_id", orgId);

    const { data: counts, error } = await query;
    if (error) throw new Error(error.message);

    for (const row of counts ?? []) {
        await admin
            .from("organizations")
            .update({ seat_count: (row as any).count })
            .eq("id", (row as any).org_id);
    }

    await logAdminAction(user.id, "recalc_org_usage", orgId ?? null, { orgsUpdated: counts?.length ?? 0 });
    revalidatePath("/admin/system");
    return { orgsUpdated: counts?.length ?? 0 };
}

export async function pruneOrphanedAttachments() {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    // List storage objects in the attachments bucket
    const { data: objects, error: listErr } = await admin.storage.from("attachments").list("", { limit: 1000 });
    if (listErr) throw new Error(listErr.message);

    const storageNames = (objects ?? []).map(o => o.name);
    if (storageNames.length === 0) return { deleted: 0 };

    // Find which names have a matching DB record
    const { data: dbRecords } = await admin
        .from("attachments")
        .select("file_path")
        .in("file_path", storageNames);

    const dbPaths = new Set((dbRecords ?? []).map(r => r.file_path));
    const orphans = storageNames.filter(name => !dbPaths.has(name));

    if (orphans.length > 0) {
        await admin.storage.from("attachments").remove(orphans);
    }

    await logAdminAction(user.id, "prune_orphaned_attachments", null, { deleted: orphans.length });
    revalidatePath("/admin/system");
    return { deleted: orphans.length };
}
