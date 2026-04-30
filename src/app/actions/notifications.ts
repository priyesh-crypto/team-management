"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

// This file re-exports notification helpers that work with the EXISTING
// notifications table schema: id, org_id, user_id, type, message, is_read, task_id, created_at

export async function getNotificationsAlt(limit = 30) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
        .from("notifications")
        .select("id, type, message, is_read, task_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(limit);

    return data ?? [];
}

export async function getUnreadCount(): Promise<number> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);

    return count ?? 0;
}

export async function markAsRead(notificationId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId)
        .eq("user_id", user.id);

    if (error) return { error: error.message };
    return { ok: true };
}

export async function markAllReadAlt(orgId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("org_id", orgId)
        .eq("is_read", false);

    if (error) return { error: error.message };
    revalidatePath("/dashboard");
    return { ok: true };
}
