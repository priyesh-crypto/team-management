"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type TaskDependency = {
    id: string;
    org_id: string;
    task_id: string;
    depends_on_id: string;
    dependency_type: string;
    created_by: string;
    created_at: string;
};

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
    const { data } = await supabase.from("organization_members").select("org_id").eq("user_id", userId).single();
    if (!data) throw new Error("No org");
    return data.org_id;
}

export async function getDependencies(taskId: string): Promise<TaskDependency[]> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("task_dependencies")
        .select("*")
        .eq("task_id", taskId);
    return (data ?? []) as TaskDependency[];
}

export async function addDependency(taskId: string, dependsOnId: string, type: "finish_to_start" | "start_to_start" = "finish_to_start") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");
    const orgId = await getOrgId(supabase, user.id);

    const { error } = await supabase.from("task_dependencies").insert({
        org_id: orgId,
        task_id: taskId,
        depends_on_id: dependsOnId,
        dependency_type: type,
        created_by: user.id,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}

export async function removeDependency(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");

    const { error } = await supabase.from("task_dependencies").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}
