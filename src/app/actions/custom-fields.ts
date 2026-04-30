"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type CustomFieldDef = {
    id: string;
    org_id: string;
    project_id: string | null;
    name: string;
    field_type: "text" | "number" | "date" | "select" | "multi_select" | "checkbox" | "url";
    options: string[] | null;
    is_required: boolean;
    sort_order: number;
    created_by: string;
    created_at: string;
};

export type CustomFieldValue = {
    id: string;
    field_def_id: string;
    task_id: string;
    value_text: string | null;
    value_number: number | null;
    value_date: string | null;
    value_json: unknown;
    updated_at: string;
};

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
    const { data } = await supabase.from("organization_members").select("org_id").eq("user_id", userId).single();
    if (!data) throw new Error("No org");
    return data.org_id;
}

export async function getCustomFieldDefs(projectId?: string): Promise<CustomFieldDef[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const orgId = await getOrgId(supabase, user.id);

    let query = supabase.from("custom_field_defs").select("*").eq("org_id", orgId).order("sort_order");
    if (projectId) {
        query = query.or(`project_id.eq.${projectId},project_id.is.null`);
    }
    const { data } = await query;
    return (data ?? []) as CustomFieldDef[];
}

export async function createCustomFieldDef(input: {
    name: string;
    field_type: CustomFieldDef["field_type"];
    project_id?: string;
    options?: string[];
    is_required?: boolean;
    sort_order?: number;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");
    const orgId = await getOrgId(supabase, user.id);

    const { error } = await supabase.from("custom_field_defs").insert({
        org_id: orgId,
        created_by: user.id,
        name: input.name,
        field_type: input.field_type,
        project_id: input.project_id ?? null,
        options: input.options ?? null,
        is_required: input.is_required ?? false,
        sort_order: input.sort_order ?? 0,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}

export async function deleteCustomFieldDef(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");

    const { error } = await supabase.from("custom_field_defs").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}

export async function getCustomFieldValues(taskId: string): Promise<CustomFieldValue[]> {
    const supabase = await createClient();
    const { data } = await supabase.from("custom_field_values").select("*").eq("task_id", taskId);
    return (data ?? []) as CustomFieldValue[];
}

export async function upsertCustomFieldValue(input: {
    field_def_id: string;
    task_id: string;
    value_text?: string;
    value_number?: number;
    value_date?: string;
    value_json?: unknown;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");

    const { data: membership } = await supabase.from("organization_members").select("org_id").eq("user_id", user.id).single();
    if (!membership) throw new Error("No org");

    const { error } = await supabase.from("custom_field_values").upsert({
        org_id: membership.org_id,
        field_def_id: input.field_def_id,
        task_id: input.task_id,
        value_text: input.value_text ?? null,
        value_number: input.value_number ?? null,
        value_date: input.value_date ?? null,
        value_json: input.value_json ?? null,
        updated_at: new Date().toISOString(),
    }, { onConflict: "field_def_id,task_id" });
    if (error) throw new Error(error.message);
}
