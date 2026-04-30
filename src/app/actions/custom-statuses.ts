"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type ProjectStatus = {
    id: string;
    org_id: string;
    project_id: string;
    name: string;
    color: string;
    sort_order: number;
    is_done: boolean;
    created_at: string;
};

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string> {
    const { data } = await supabase
        .from("organization_members")
        .select("org_id")
        .eq("user_id", userId)
        .single();
    if (!data) throw new Error("Not a member of any organization");
    return data.org_id;
}

export async function getProjectStatuses(projectId: string): Promise<ProjectStatus[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");

    const { data, error } = await supabase
        .from("project_statuses")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });

    if (error) throw new Error(error.message);
    return (data ?? []) as ProjectStatus[];
}

export async function createProjectStatus(input: {
    project_id: string;
    name: string;
    color?: string;
    sort_order?: number;
    is_done?: boolean;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");
    const orgId = await getOrgId(supabase, user.id);

    const { error } = await supabase.from("project_statuses").insert({
        org_id: orgId,
        project_id: input.project_id,
        name: input.name,
        color: input.color ?? "#86868b",
        sort_order: input.sort_order ?? 0,
        is_done: input.is_done ?? false,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}

export async function updateProjectStatus(id: string, updates: Partial<Pick<ProjectStatus, "name" | "color" | "sort_order" | "is_done">>) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");

    const { error } = await supabase
        .from("project_statuses")
        .update(updates)
        .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}

export async function deleteProjectStatus(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");

    const { error } = await supabase
        .from("project_statuses")
        .delete()
        .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}

export async function setTaskCustomStatus(taskId: string, statusId: string | null) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");

    const { error } = await supabase
        .from("tasks")
        .update({ custom_status_id: statusId })
        .eq("id", taskId);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}
