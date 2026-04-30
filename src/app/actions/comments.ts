"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type Comment = {
    id: string;
    task_id: string;
    user_id: string;
    content: string;
    mentions: string[];
    edited_at: string | null;
    created_at: string;
};

export type Reaction = {
    id: string;
    comment_id: string;
    user_id: string;
    emoji: string;
    created_at: string;
};

export async function getComments(taskId: string): Promise<Comment[]> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("task_comments")
        .select("id, task_id, user_id, content, mentions, edited_at, created_at")
        .eq("task_id", taskId)
        .order("created_at");
    return (data ?? []) as Comment[];
}

export async function getReactions(commentIds: string[]): Promise<Reaction[]> {
    if (commentIds.length === 0) return [];
    const supabase = await createClient();
    const { data } = await supabase
        .from("comment_reactions")
        .select("id, comment_id, user_id, emoji, created_at")
        .in("comment_id", commentIds);
    return (data ?? []) as Reaction[];
}

export async function addComment(taskId: string, orgId: string, content: string, mentions: string[] = []) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data, error } = await supabase
        .from("task_comments")
        .insert({ task_id: taskId, org_id: orgId, user_id: user.id, content, mentions })
        .select("id, task_id, user_id, content, mentions, edited_at, created_at")
        .single();

    if (error) return { error: error.message };
    revalidatePath("/dashboard");
    return { data };
}

export async function editComment(commentId: string, content: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase
        .from("task_comments")
        .update({ content, edited_at: new Date().toISOString() })
        .eq("id", commentId)
        .eq("user_id", user.id);

    if (error) return { error: error.message };
    return { ok: true };
}

export async function deleteComment(commentId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase
        .from("task_comments")
        .delete()
        .eq("id", commentId)
        .eq("user_id", user.id);

    if (error) return { error: error.message };
    return { ok: true };
}

export async function toggleReaction(commentId: string, orgId: string, emoji: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    // Check if already reacted
    const { data: existing } = await supabase
        .from("comment_reactions")
        .select("id")
        .eq("comment_id", commentId)
        .eq("user_id", user.id)
        .eq("emoji", emoji)
        .maybeSingle();

    if (existing) {
        await supabase.from("comment_reactions").delete().eq("id", existing.id);
        return { action: "removed" };
    }

    const { error } = await supabase
        .from("comment_reactions")
        .insert({ comment_id: commentId, org_id: orgId, user_id: user.id, emoji });

    if (error) return { error: error.message };
    return { action: "added" };
}
