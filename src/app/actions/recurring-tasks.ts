"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type RecurringTemplate = {
    id: string;
    org_id: string;
    created_by: string;
    name: string;
    notes: string | null;
    priority: string;
    frequency: "daily" | "weekly" | "monthly";
    interval: number;
    day_of_week: number | null;
    day_of_month: number | null;
    estimated_hours: number | null;
    assignee_ids: string[] | null;
    workspace_id: string | null;
    project_id: string | null;
    is_active: boolean;
    next_run_at: string | null;
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

export async function getRecurringTemplates(): Promise<RecurringTemplate[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");
    const orgId = await getOrgId(supabase, user.id);

    const { data, error } = await supabase
        .from("recurring_task_templates")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as RecurringTemplate[];
}

export async function createRecurringTemplate(input: {
    name: string;
    notes?: string;
    priority?: string;
    frequency: "daily" | "weekly" | "monthly";
    interval?: number;
    day_of_week?: number;
    day_of_month?: number;
    estimated_hours?: number;
    assignee_ids?: string[];
    workspace_id?: string;
    project_id?: string;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");
    const orgId = await getOrgId(supabase, user.id);

    // Compute next_run_at (approximate — cron will reconcile)
    const now = new Date();
    let next = new Date(now);
    if (input.frequency === "daily") next.setDate(now.getDate() + (input.interval ?? 1));
    else if (input.frequency === "weekly") next.setDate(now.getDate() + 7 * (input.interval ?? 1));
    else next.setMonth(now.getMonth() + (input.interval ?? 1));

    const { error } = await supabase.from("recurring_task_templates").insert({
        org_id: orgId,
        created_by: user.id,
        name: input.name,
        notes: input.notes ?? null,
        priority: input.priority ?? "Medium",
        frequency: input.frequency,
        interval: input.interval ?? 1,
        day_of_week: input.day_of_week ?? null,
        day_of_month: input.day_of_month ?? null,
        estimated_hours: input.estimated_hours ?? null,
        assignee_ids: input.assignee_ids ?? null,
        workspace_id: input.workspace_id ?? null,
        project_id: input.project_id ?? null,
        next_run_at: next.toISOString(),
    });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}

export async function toggleRecurringTemplate(id: string, is_active: boolean) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");

    const { error } = await supabase
        .from("recurring_task_templates")
        .update({ is_active })
        .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}

export async function deleteRecurringTemplate(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");

    const { error } = await supabase
        .from("recurring_task_templates")
        .delete()
        .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}
