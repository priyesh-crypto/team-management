"use server";

import { createAdminClient } from "@/utils/supabase/admin";
import { requirePlatformAdmin, logAdminAction } from "@/lib/platform-admin";
import { revalidatePath } from "next/cache";

// ── GDPR — Data export ─────────────────────────────────────────────────────────

export async function initiateGdprExport(orgId: string, userId: string, notes?: string) {
    const admin_user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const { data: req, error } = await admin
        .from("gdpr_requests")
        .insert({
            org_id: orgId,
            user_id: userId,
            type: "export",
            status: "processing",
            notes: notes?.trim() || null,
            requested_by: admin_user.id,
        })
        .select("id")
        .single();
    if (error || !req) throw new Error(error?.message ?? "Failed to create GDPR request");

    // Generate export inline
    const [
        { data: tasks },
        { data: members },
        { data: comments },
        { data: notifications },
    ] = await Promise.all([
        admin.from("tasks").select("id, title, description, status, priority, due_date, created_at").eq("org_id", orgId),
        admin.from("organization_members").select("user_id, role, created_at").eq("org_id", orgId),
        admin.from("task_comments").select("id, task_id, content, created_at").eq("org_id", orgId).eq("user_id", userId),
        admin.from("notifications").select("type, title, body, created_at, read_at").eq("org_id", orgId).eq("user_id", userId),
    ]);

    const exportData = {
        generated_at: new Date().toISOString(),
        org_id: orgId,
        user_id: userId,
        tasks: tasks ?? [],
        org_members: members ?? [],
        user_comments: comments ?? [],
        user_notifications: notifications ?? [],
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const fileName = `gdpr-export-${orgId}-${userId}-${Date.now()}.json`;

    // Upload to Supabase storage (bucket: gdpr-exports)
    const { error: uploadError } = await admin.storage
        .from("gdpr-exports")
        .upload(fileName, jsonStr, { contentType: "application/json", upsert: false });

    let fileUrl: string | null = null;
    if (!uploadError) {
        const { data: signedUrl } = await admin.storage
            .from("gdpr-exports")
            .createSignedUrl(fileName, 86400); // 24h signed URL
        fileUrl = signedUrl?.signedUrl ?? null;
    }

    await admin
        .from("gdpr_requests")
        .update({
            status: "completed",
            file_url: fileUrl,
            completed_at: new Date().toISOString(),
        })
        .eq("id", req.id);

    await logAdminAction(admin_user.id, "gdpr_export", orgId, { userId, requestId: req.id });
    revalidatePath("/admin/gdpr");

    return { requestId: req.id, fileUrl };
}

// ── GDPR — Anonymize user ──────────────────────────────────────────────────────

export async function anonymizeUser(orgId: string, userId: string, notes?: string) {
    const admin_user = await requirePlatformAdmin();
    const admin = createAdminClient();

    const { data: req, error } = await admin
        .from("gdpr_requests")
        .insert({
            org_id: orgId,
            user_id: userId,
            type: "anonymize",
            status: "processing",
            notes: notes?.trim() || null,
            requested_by: admin_user.id,
        })
        .select("id")
        .single();
    if (error || !req) throw new Error(error?.message ?? "Failed to create GDPR request");

    // Anonymize profile
    const anonName = `Deleted User ${userId.slice(0, 6)}`;
    await admin
        .from("profiles")
        .update({ full_name: anonName, avatar_url: null })
        .eq("id", userId);

    // Anonymize auth email via admin API
    const anonEmail = `deleted-${userId}@anonymized.invalid`;
    try {
        await admin.auth.admin.updateUserById(userId, {
            email: anonEmail,
            user_metadata: { anonymized: true, anonymized_at: new Date().toISOString() },
        });
    } catch {
        // Best-effort — profile anonymization already done
    }

    await admin
        .from("gdpr_requests")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", req.id);

    await logAdminAction(admin_user.id, "gdpr_anonymize", orgId, { userId, requestId: req.id });
    revalidatePath("/admin/gdpr");

    return { requestId: req.id };
}

export async function getGdprRequests() {
    await requirePlatformAdmin();
    const admin = createAdminClient();

    const { data } = await admin
        .from("gdpr_requests")
        .select("id, org_id, user_id, type, status, notes, file_url, requested_at, completed_at, organizations(name)")
        .order("requested_at", { ascending: false });

    return (data ?? []) as unknown as Array<{
        id: string;
        org_id: string | null;
        user_id: string;
        type: string;
        status: string;
        notes: string | null;
        file_url: string | null;
        requested_at: string;
        completed_at: string | null;
        organizations: { name: string } | null;
    }>;
}

// ── Support tickets ────────────────────────────────────────────────────────────

export async function createSupportTicket(
    orgId: string,
    subject: string,
    priority: string,
    firstMessage: string
) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    if (!subject.trim() || !firstMessage.trim()) throw new Error("Subject and message are required.");

    const { data: ticket, error } = await admin
        .from("support_tickets")
        .insert({ org_id: orgId, opened_by: user.id, subject: subject.trim(), priority })
        .select("id")
        .single();
    if (error || !ticket) throw new Error(error?.message ?? "Failed to create ticket");

    await admin.from("support_messages").insert({
        ticket_id: ticket.id,
        author_id: user.id,
        body: firstMessage.trim(),
        is_internal: false,
    });

    await logAdminAction(user.id, "create_support_ticket", orgId, { ticketId: ticket.id, subject });
    revalidatePath("/admin/support");
    return { ticketId: ticket.id };
}

export async function getSupportTickets(status?: string) {
    await requirePlatformAdmin();
    const admin = createAdminClient();

    let query = admin
        .from("support_tickets")
        .select("id, org_id, subject, status, priority, created_at, updated_at, organizations(name)")
        .order("updated_at", { ascending: false });

    if (status && status !== "all") query = query.eq("status", status);

    const { data } = await query;
    return (data ?? []) as unknown as Array<{
        id: string;
        org_id: string | null;
        subject: string;
        status: string;
        priority: string;
        created_at: string;
        updated_at: string;
        organizations: { name: string } | null;
    }>;
}

export async function getTicketThread(ticketId: string) {
    await requirePlatformAdmin();
    const admin = createAdminClient();

    const [{ data: ticket }, { data: messages }] = await Promise.all([
        admin
            .from("support_tickets")
            .select("id, org_id, subject, status, priority, created_at, organizations(name)")
            .eq("id", ticketId)
            .single(),
        admin
            .from("support_messages")
            .select("id, author_id, body, is_internal, created_at")
            .eq("ticket_id", ticketId)
            .order("created_at"),
    ]);

    return {
        ticket: ticket as unknown as {
            id: string; org_id: string | null; subject: string;
            status: string; priority: string; created_at: string;
            organizations: { name: string } | null;
        } | null,
        messages: messages ?? [],
    };
}

export async function addSupportMessage(ticketId: string, body: string, isInternal: boolean) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    if (!body.trim()) throw new Error("Message body is required.");

    await admin.from("support_messages").insert({
        ticket_id: ticketId,
        author_id: user.id,
        body: body.trim(),
        is_internal: isInternal,
    });

    await admin
        .from("support_tickets")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", ticketId);

    revalidatePath(`/admin/support/${ticketId}`);
}

export async function updateTicketStatus(ticketId: string, status: string) {
    const user = await requirePlatformAdmin();
    const admin = createAdminClient();

    await admin
        .from("support_tickets")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", ticketId);

    await logAdminAction(user.id, "update_ticket_status", null, { ticketId, status });
    revalidatePath(`/admin/support/${ticketId}`);
    revalidatePath("/admin/support");
}

// ── System health ──────────────────────────────────────────────────────────────

export async function getSystemHealth() {
    await requirePlatformAdmin();
    const admin = createAdminClient();

    const [
        { count: totalOrgs },
        { count: suspendedOrgs },
        { data: webhookStats },
        { data: apiKeyStats },
        { data: recentAdminActions },
        { count: openTickets },
        { count: pendingGdpr },
    ] = await Promise.all([
        admin.from("organizations").select("*", { count: "exact", head: true }),
        admin.from("organizations").select("*", { count: "exact", head: true }).not("suspended_at", "is", null),
        admin.from("org_webhooks").select("failure_count, is_active, last_triggered_at"),
        admin.from("api_keys").select("last_used_at, is_active, created_at").eq("is_active", true),
        admin
            .from("platform_admin_actions")
            .select("action, created_at")
            .order("created_at", { ascending: false })
            .limit(20),
        admin.from("support_tickets").select("*", { count: "exact", head: true }).eq("status", "open"),
        admin.from("gdpr_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    const allWebhooks = webhookStats ?? [];
    const failingWebhooks = allWebhooks.filter(w => w.failure_count > 0 && w.is_active);
    const activeWebhooks = allWebhooks.filter(w => w.is_active);

    const allKeys = apiKeyStats ?? [];
    const recentlyUsedKeys = allKeys.filter(k => {
        if (!k.last_used_at) return false;
        return new Date(k.last_used_at) > new Date(Date.now() - 7 * 86400000);
    });

    // Action breakdown
    const actionCounts: Record<string, number> = {};
    for (const a of recentAdminActions ?? []) {
        actionCounts[a.action] = (actionCounts[a.action] ?? 0) + 1;
    }

    return {
        orgs: { total: totalOrgs ?? 0, suspended: suspendedOrgs ?? 0 },
        webhooks: {
            active: activeWebhooks.length,
            failing: failingWebhooks.length,
            totalFailures: failingWebhooks.reduce((s, w) => s + (w.failure_count ?? 0), 0),
        },
        apiKeys: {
            active: allKeys.length,
            usedLast7Days: recentlyUsedKeys.length,
        },
        support: { openTickets: openTickets ?? 0 },
        gdpr: { pendingRequests: pendingGdpr ?? 0 },
        recentActions: actionCounts,
    };
}
