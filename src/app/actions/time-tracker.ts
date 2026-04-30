"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type TimeEntry = {
    id: string;
    org_id: string;
    task_id: string;
    user_id: string;
    started_at: string;
    stopped_at: string | null;
    duration_seconds: number | null;
    notes: string | null;
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

export async function getRunningEntry(taskId: string): Promise<TimeEntry | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase
        .from("time_entries")
        .select("*")
        .eq("task_id", taskId)
        .eq("user_id", user.id)
        .is("stopped_at", null)
        .maybeSingle();

    return (data ?? null) as TimeEntry | null;
}

export async function getTaskTimeEntries(taskId: string): Promise<TimeEntry[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
        .from("time_entries")
        .select("*")
        .eq("task_id", taskId)
        .order("started_at", { ascending: false });

    return (data ?? []) as TimeEntry[];
}

export async function startTimer(taskId: string): Promise<TimeEntry> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");
    const orgId = await getOrgId(supabase, user.id);

    // Stop any other running timers for this user first
    const { data: running } = await supabase
        .from("time_entries")
        .select("id, started_at")
        .eq("user_id", user.id)
        .is("stopped_at", null);

    if (running && running.length > 0) {
        for (const entry of running) {
            const duration = Math.floor((Date.now() - new Date(entry.started_at).getTime()) / 1000);
            await supabase
                .from("time_entries")
                .update({ stopped_at: new Date().toISOString(), duration_seconds: duration })
                .eq("id", entry.id);
        }
    }

    const { data, error } = await supabase
        .from("time_entries")
        .insert({
            org_id: orgId,
            task_id: taskId,
            user_id: user.id,
            started_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
    return data as TimeEntry;
}

export async function stopTimer(entryId: string): Promise<TimeEntry> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");

    const { data: entry } = await supabase
        .from("time_entries")
        .select("started_at")
        .eq("id", entryId)
        .single();

    if (!entry) throw new Error("Timer not found");

    const duration = Math.floor((Date.now() - new Date(entry.started_at).getTime()) / 1000);
    const stoppedAt = new Date().toISOString();

    const { data, error } = await supabase
        .from("time_entries")
        .update({ stopped_at: stoppedAt, duration_seconds: duration })
        .eq("id", entryId)
        .select()
        .single();

    if (error) throw new Error(error.message);

    // Roll up total tracked time into hours_spent on the task
    const { data: totals } = await supabase
        .from("time_entries")
        .select("duration_seconds")
        .eq("task_id", data.task_id)
        .not("duration_seconds", "is", null);

    if (totals) {
        const totalSeconds = totals.reduce((sum: number, e: { duration_seconds: number | null }) => sum + (e.duration_seconds ?? 0), 0);
        await supabase
            .from("tasks")
            .update({ hours_spent: parseFloat((totalSeconds / 3600).toFixed(2)) })
            .eq("id", data.task_id);
    }

    revalidatePath("/dashboard");
    return data as TimeEntry;
}

export async function getTotalTrackedHours(taskId: string): Promise<number> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("time_entries")
        .select("duration_seconds")
        .eq("task_id", taskId)
        .not("duration_seconds", "is", null);

    if (!data) return 0;
    const total = data.reduce((sum: number, e: { duration_seconds: number | null }) => sum + (e.duration_seconds ?? 0), 0);
    return parseFloat((total / 3600).toFixed(2));
}
