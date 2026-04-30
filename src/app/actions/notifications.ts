"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export type Notification = {
    id: string;
    type: string;
    title: string;
    body: string | null;
    resource_type: string | null;
    resource_id: string | null;
    actor_id: string | null;
    actor_email: string | null;
    read_at: string | null;
    created_at: string;
};

export async function getNotifications(limit = 30): Promise<Notification[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
        .from("notifications")
        .select("id, type, title, body, resource_type, resource_id, actor_id, actor_email, read_at, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

    return (data ?? []) as Notification[];
}

export async function getUnreadCount(): Promise<number> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null);

    return count ?? 0;
}

export async function markAsRead(notificationId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", user.id);

    if (error) return { error: error.message };
    return { ok: true };
}

export async function markAllRead(orgId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("org_id", orgId)
        .is("read_at", null);

    if (error) return { error: error.message };
    revalidatePath("/dashboard");
    return { ok: true };
}

// Called by server actions that create events (task assigned, comment mention, etc.)
export async function createNotification(params: {
    orgId: string;
    userId: string;
    type: string;
    title: string;
    body?: string;
    resourceType?: string;
    resourceId?: string;
    actorId?: string;
    actorEmail?: string;
}) {
    const admin = createAdminClient();
    const { error } = await admin.from("notifications").insert({
        org_id: params.orgId,
        user_id: params.userId,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        resource_type: params.resourceType ?? null,
        resource_id: params.resourceId ?? null,
        actor_id: params.actorId ?? null,
        actor_email: params.actorEmail ?? null,
    });
    return error ? { error: error.message } : { ok: true };
}
