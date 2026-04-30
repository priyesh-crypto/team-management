"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type ApprovalRequest = {
    id: string;
    org_id: string;
    task_id: string;
    workflow_id: string;
    current_step: number;
    status: "pending" | "approved" | "rejected" | "cancelled";
    requested_by: string;
    decided_by: string | null;
    decision_note: string | null;
    decided_at: string | null;
    created_at: string;
};

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
    const { data } = await supabase.from("organization_members").select("org_id").eq("user_id", userId).single();
    if (!data) throw new Error("No org");
    return data.org_id;
}

export async function getPendingApprovals(): Promise<(ApprovalRequest & { task_name?: string })[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const orgId = await getOrgId(supabase, user.id);

    const { data } = await supabase
        .from("approval_requests")
        .select("*, tasks(name)")
        .eq("org_id", orgId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

    return (data ?? []).map(r => ({
        ...r,
        task_name: Array.isArray(r.tasks) ? r.tasks[0]?.name : (r.tasks as { name: string } | null)?.name,
    })) as (ApprovalRequest & { task_name?: string })[];
}

export async function requestApproval(taskId: string, workflowId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");
    const orgId = await getOrgId(supabase, user.id);

    const { error } = await supabase.from("approval_requests").insert({
        org_id: orgId,
        task_id: taskId,
        workflow_id: workflowId,
        requested_by: user.id,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}

export async function decideApproval(requestId: string, decision: "approved" | "rejected", note?: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");

    const { error } = await supabase.from("approval_requests").update({
        status: decision,
        decided_by: user.id,
        decision_note: note ?? null,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).eq("id", requestId);
    if (error) throw new Error(error.message);

    if (decision === "approved") {
        const { data: req } = await supabase.from("approval_requests").select("task_id").eq("id", requestId).single();
        if (req) {
            await supabase.from("tasks").update({ status: "Completed" }).eq("id", req.task_id);
        }
    }

    revalidatePath("/dashboard");
}
