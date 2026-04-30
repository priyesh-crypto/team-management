"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export type Form = {
    id: string;
    org_id: string;
    created_by: string;
    name: string;
    description: string | null;
    workspace_id: string | null;
    project_id: string | null;
    default_assignee_id: string | null;
    default_priority: string;
    fields: FormField[];
    is_active: boolean;
    submit_message: string;
    created_at: string;
};

export type FormField = {
    id: string;
    label: string;
    type: "text" | "textarea" | "email" | "select" | "date" | "checkbox";
    options?: string[];
    required: boolean;
    placeholder?: string;
};

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
    const { data } = await supabase.from("organization_members").select("org_id").eq("user_id", userId).single();
    if (!data) throw new Error("No org");
    return data.org_id;
}

export async function getForms(): Promise<Form[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const orgId = await getOrgId(supabase, user.id);
    const { data } = await supabase.from("forms").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
    return (data ?? []) as Form[];
}

export async function createForm(input: {
    name: string;
    description?: string;
    workspace_id?: string;
    project_id?: string;
    default_assignee_id?: string;
    default_priority?: string;
    fields?: FormField[];
    submit_message?: string;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");
    const orgId = await getOrgId(supabase, user.id);

    const { data, error } = await supabase.from("forms").insert({
        org_id: orgId,
        created_by: user.id,
        name: input.name,
        description: input.description ?? null,
        workspace_id: input.workspace_id ?? null,
        project_id: input.project_id ?? null,
        default_assignee_id: input.default_assignee_id ?? null,
        default_priority: input.default_priority ?? "Medium",
        fields: input.fields ?? [],
        submit_message: input.submit_message ?? "Thank you! Your request has been submitted.",
    }).select("id").single();
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
    return data.id as string;
}

export async function deleteForm(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");
    const { error } = await supabase.from("forms").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}

/** Public: resolve a form by ID without auth (used by /f/[id] page) */
export async function resolvePublicForm(formId: string): Promise<Form | null> {
    const admin = createAdminClient();
    const { data } = await admin.from("forms").select("*").eq("id", formId).eq("is_active", true).maybeSingle();
    return (data ?? null) as Form | null;
}

/** Public: submit a form — creates a task and saves submission */
export async function submitForm(formId: string, data: {
    submitter_name?: string;
    submitter_email?: string;
    fields: Record<string, unknown>;
}) {
    const admin = createAdminClient();

    const { data: form } = await admin.from("forms").select("*").eq("id", formId).eq("is_active", true).maybeSingle();
    if (!form) throw new Error("Form not found or inactive");

    // Build task name from first text field or fallback
    const taskName = (data.fields["Task title"] || data.fields["Title"] || data.fields["Name"] || `Form submission from ${data.submitter_name ?? "visitor"}`) as string;
    const taskNotes = Object.entries(data.fields)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join("\n");

    // Create task
    let taskId: string | null = null;
    if (form.workspace_id) {
        const { data: task } = await admin.from("tasks").insert({
            org_id: form.org_id,
            workspace_id: form.workspace_id,
            project_id: form.project_id,
            employee_id: form.default_assignee_id ?? form.created_by,
            name: String(taskName).slice(0, 200),
            notes: taskNotes,
            priority: form.default_priority ?? "Medium",
            status: "To Do",
            start_date: new Date().toISOString().split("T")[0],
            deadline: new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0],
        }).select("id").single();
        taskId = task?.id ?? null;
    }

    // Save submission
    await admin.from("form_submissions").insert({
        org_id: form.org_id,
        form_id: formId,
        task_id: taskId,
        submitter_name: data.submitter_name ?? null,
        submitter_email: data.submitter_email ?? null,
        data: data.fields,
    });

    return { success: true, taskId, message: form.submit_message };
}
