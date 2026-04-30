"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type Sprint = {
    id: string;
    workspace_id: string;
    name: string;
    goal: string | null;
    start_date: string;
    end_date: string;
    status: string;
    created_at: string;
};

export type SprintTask = {
    id: string;
    name: string;
    status: string;
    priority: string;
    story_points: number | null;
    employee_id: string;
};

export async function getSprints(orgId: string, workspaceId?: string): Promise<Sprint[]> {
    const supabase = await createClient();
    let q = supabase
        .from("sprints")
        .select("id, workspace_id, name, goal, start_date, end_date, status, created_at")
        .eq("org_id", orgId)
        .order("start_date", { ascending: false });
    if (workspaceId) q = q.eq("workspace_id", workspaceId);
    const { data } = await q;
    return (data ?? []) as Sprint[];
}

export async function getSprintTasks(sprintId: string): Promise<SprintTask[]> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("tasks")
        .select("id, name, status, priority, story_points, employee_id")
        .eq("sprint_id", sprintId);
    return (data ?? []) as SprintTask[];
}

export async function createSprint(orgId: string, workspaceId: string, name: string, goal: string, startDate: string, endDate: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data, error } = await supabase
        .from("sprints")
        .insert({ org_id: orgId, workspace_id: workspaceId, name, goal: goal || null, start_date: startDate, end_date: endDate, created_by: user.id })
        .select("id, workspace_id, name, goal, start_date, end_date, status, created_at")
        .single();

    if (error) return { error: error.message };
    revalidatePath("/dashboard");
    return { data };
}

export async function updateSprintStatus(sprintId: string, status: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("sprints")
        .update({ status })
        .eq("id", sprintId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard");
    return { ok: true };
}

export async function assignTaskToSprint(taskId: string, sprintId: string | null) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("tasks")
        .update({ sprint_id: sprintId })
        .eq("id", taskId);
    if (error) return { error: error.message };
    return { ok: true };
}

export async function setStoryPoints(taskId: string, points: number | null) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("tasks")
        .update({ story_points: points })
        .eq("id", taskId);
    if (error) return { error: error.message };
    return { ok: true };
}
