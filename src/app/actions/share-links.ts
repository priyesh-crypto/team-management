"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export type ShareToken = {
    id: string;
    org_id: string;
    created_by: string;
    resource_type: string;
    resource_id: string;
    token: string;
    expires_at: string | null;
    allow_comments: boolean;
    is_active: boolean;
    view_count: number;
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

export async function createShareLink(input: {
    resource_type: "project" | "task";
    resource_id: string;
    expires_in_days?: number;
    allow_comments?: boolean;
}): Promise<ShareToken> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");
    const orgId = await getOrgId(supabase, user.id);

    const expiresAt = input.expires_in_days
        ? new Date(Date.now() + input.expires_in_days * 86400000).toISOString()
        : null;

    const { data, error } = await supabase
        .from("share_tokens")
        .insert({
            org_id: orgId,
            created_by: user.id,
            resource_type: input.resource_type,
            resource_id: input.resource_id,
            expires_at: expiresAt,
            allow_comments: input.allow_comments ?? false,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
    return data as ShareToken;
}

export async function revokeShareLink(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");

    const { error } = await supabase
        .from("share_tokens")
        .update({ is_active: false })
        .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}

export async function getShareLinksForResource(resourceId: string): Promise<ShareToken[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
        .from("share_tokens")
        .select("*")
        .eq("resource_id", resourceId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

    return (data ?? []) as ShareToken[];
}

/** Used by the public /share/[token] route — no auth required */
export async function resolveShareToken(token: string): Promise<{
    token: ShareToken;
    resource: any;
    tasks?: any[];
    subtasksMap?: Record<string, any[]>;
    employees?: any[];
} | null> {
    const admin = createAdminClient();

    const { data: tokenRow } = await admin
        .from("share_tokens")
        .select("*")
        .eq("token", token)
        .eq("is_active", true)
        .maybeSingle();

    if (!tokenRow) return null;
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) return null;

    // Increment view counter
    await admin.from("share_tokens").update({ view_count: (tokenRow.view_count ?? 0) + 1 }).eq("id", tokenRow.id);

    let resource: any = null;
    let tasks: any[] = [];
    let subtasksMap: Record<string, any[]> = {};
    let employees: any[] = [];

    if (tokenRow.resource_type === "project") {
        const { data: project } = await admin
            .from("projects")
            .select("*")
            .eq("id", tokenRow.resource_id)
            .single();
        
        if (!project) return null;
        resource = project;

        // Fetch tasks
        const { data: projectTasks } = await admin
            .from("tasks")
            .select("*")
            .eq("project_id", project.id)
            .order("deadline", { ascending: true });
        
        tasks = projectTasks || [];

        if (tasks.length > 0) {
            const taskIds = tasks.map(t => t.id);
            const { data: subtasks } = await admin
                .from("subtasks")
                .select("*")
                .in("task_id", taskIds);
            
            subtasks?.forEach(s => {
                if (!subtasksMap[s.task_id]) subtasksMap[s.task_id] = [];
                subtasksMap[s.task_id].push(s);
            });

            // Fetch assignee profiles
            const allAssigneeIds = Array.from(new Set(tasks.flatMap(t => [t.employee_id, ...(t.assignee_ids || [])])));
            const { data: profiles } = await admin
                .from("profiles")
                .select("id, name, avatar_url")
                .in("id", allAssigneeIds);
            
            employees = profiles || [];
        }
    } else if (tokenRow.resource_type === "task") {
        const { data: task } = await admin
            .from("tasks")
            .select("*")
            .eq("id", tokenRow.resource_id)
            .single();
        
        if (!task) return null;
        resource = task;

        const { data: subtasks } = await admin
            .from("subtasks")
            .select("*")
            .eq("task_id", task.id);
        
        subtasksMap[task.id] = subtasks || [];
        tasks = [task];

        const allAssigneeIds = Array.from(new Set([task.employee_id, ...(task.assignee_ids || [])]));
        const { data: profiles } = await admin
            .from("profiles")
            .select("id, name, avatar_url")
            .in("id", allAssigneeIds);
        
        employees = profiles || [];
    }

    if (!resource) return null;
    
    return { 
        token: tokenRow as ShareToken, 
        resource, 
        tasks, 
        subtasksMap,
        employees
    };
}
