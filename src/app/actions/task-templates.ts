"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type TaskTemplate = {
    id: string;
    org_id: string;
    created_by: string;
    name: string;
    description: string | null;
    template_data: Record<string, unknown>;
    is_public: boolean;
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

export async function getTaskTemplates(): Promise<TaskTemplate[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");
    const orgId = await getOrgId(supabase, user.id);

    const { data, error } = await supabase
        .from("task_templates")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as TaskTemplate[];
}

export async function saveTaskAsTemplate(input: {
    name: string;
    description?: string;
    template_data: Record<string, unknown>;
    is_public?: boolean;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");
    const orgId = await getOrgId(supabase, user.id);

    const { error } = await supabase.from("task_templates").insert({
        org_id: orgId,
        created_by: user.id,
        name: input.name,
        description: input.description ?? null,
        template_data: input.template_data,
        is_public: input.is_public ?? true,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}

export async function deleteTaskTemplate(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");

    const { error } = await supabase
        .from("task_templates")
        .delete()
        .eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}
