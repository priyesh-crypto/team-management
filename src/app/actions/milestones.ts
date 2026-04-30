"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type Milestone = {
    id: string;
    workspace_id: string;
    name: string;
    description: string | null;
    due_date: string | null;
    status: string;
    color: string;
    created_at: string;
    task_count?: number;
    completed_count?: number;
};

export async function getMilestones(orgId: string, workspaceId?: string): Promise<Milestone[]> {
    const supabase = await createClient();
    let q = supabase
        .from("milestones")
        .select("id, workspace_id, name, description, due_date, status, color, created_at")
        .eq("org_id", orgId)
        .order("due_date", { ascending: true });
    if (workspaceId) q = q.eq("workspace_id", workspaceId);
    const { data } = await q;
    return (data ?? []) as Milestone[];
}

export async function createMilestone(orgId: string, workspaceId: string, name: string, description: string, dueDate: string | null, color: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data, error } = await supabase
        .from("milestones")
        .insert({ org_id: orgId, workspace_id: workspaceId, name, description: description || null, due_date: dueDate, color, created_by: user.id })
        .select("id, workspace_id, name, description, due_date, status, color, created_at")
        .single();

    if (error) return { error: error.message };
    revalidatePath("/dashboard");
    return { data };
}

export async function updateMilestoneStatus(milestoneId: string, status: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("milestones")
        .update({ status })
        .eq("id", milestoneId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard");
    return { ok: true };
}

export async function deleteMilestone(milestoneId: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("milestones")
        .delete()
        .eq("id", milestoneId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard");
    return { ok: true };
}

export async function assignTaskToMilestone(taskId: string, milestoneId: string | null) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("tasks")
        .update({ milestone_id: milestoneId })
        .eq("id", taskId);
    if (error) return { error: error.message };
    return { ok: true };
}
