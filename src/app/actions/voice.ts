"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

async function getSessionOrgId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string> {
    const { data } = await supabase
        .from("organization_members")
        .select("org_id")
        .eq("user_id", userId)
        .single();
    if (!data) throw new Error("No organization found for user");
    return data.org_id;
}

async function validateProjectAccess(
    supabase: Awaited<ReturnType<typeof createClient>>,
    projectId: string,
    orgId: string,
): Promise<void> {
    const { data } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("org_id", orgId)
        .maybeSingle();
    if (!data) throw new Error("Unauthorized: project does not belong to your organization");
}

export async function processVoiceCommandAction(text: string, projectId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const orgId = await getSessionOrgId(supabase, user.id);
    await validateProjectAccess(supabase, projectId, orgId);

    const lower = text.toLowerCase();

    // 1. Identify Intent
    let intent: 'create' | 'update_status' | 'update_priority' | 'unknown' = 'unknown';
    if (lower.includes('assign') || lower.includes('create') || lower.includes('add task')) intent = 'create';
    else if (lower.includes('move') || lower.includes('status')) intent = 'update_status';
    else if (lower.includes('priority')) intent = 'update_priority';

    // 2. Extract Data

    // Priority
    let priority = 'Medium';
    if (lower.includes('urgent')) priority = 'Urgent';
    else if (lower.includes('high')) priority = 'High';
    else if (lower.includes('low')) priority = 'Low';

    // Status
    let status = 'To Do';
    if (lower.includes('completed') || lower.includes('done') || lower.includes('finish')) status = 'Completed';
    else if (lower.includes('progress')) status = 'In Progress';
    else if (lower.includes('review')) status = 'In Review';
    else if (lower.includes('blocked')) status = 'Blocked';

    // Task Name
    let taskName = "";
    if (intent === 'create') {
        const matches = text.match(/task (?:named |called )?['"]?([^'"]+)['"]? (?:for|to|due)/i) ||
                       text.match(/create (?:a )?task (?:named |called )?['"]?([^'"]+)['"]?/i);
        taskName = matches ? matches[1].trim() : "New Voice Task";
    }

    // Deadline
    let deadline = new Date();
    deadline.setDate(deadline.getDate() + 3);
    if (lower.includes('tomorrow')) {
        deadline = new Date();
        deadline.setDate(deadline.getDate() + 1);
    } else if (lower.includes('friday')) {
        const d = new Date();
        d.setDate(d.getDate() + (5 + 7 - d.getDay()) % 7);
        deadline = d;
    } else if (lower.includes('monday')) {
        const d = new Date();
        d.setDate(d.getDate() + (1 + 7 - d.getDay()) % 7);
        deadline = d;
    }

    // 3. Execute — use ilike for DB-level matching instead of pulling all rows

    if (intent === 'create') {
        // Find assignee by name using DB search scoped to this org
        const words = lower.split(/\s+/);
        let assigneeId: string | null = null;

        // Try progressively shorter name fragments (longest match first)
        for (let len = words.length; len >= 1 && !assigneeId; len--) {
            for (let start = 0; start <= words.length - len && !assigneeId; start++) {
                const fragment = words.slice(start, start + len).join(' ');
                if (fragment.length < 2) continue;
                const { data: match } = await supabase
                    .from('profiles')
                    .select('id, name')
                    .eq('org_id', orgId)
                    .ilike('name', `%${fragment}%`)
                    .limit(1)
                    .maybeSingle();
                if (match) assigneeId = match.id;
            }
        }

        await supabase.from('tasks').insert({
            name: taskName,
            project_id: projectId,
            org_id: orgId,
            employee_id: assigneeId,
            priority,
            status,
            deadline: deadline.toISOString(),
            start_date: new Date().toISOString(),
        });

        revalidatePath('/dashboard');
        return { success: true, intent, taskName, assigneeId };
    }

    if (intent === 'update_status' || intent === 'update_priority') {
        // Extract the longest quoted or capitalized token as the task name fragment
        const quoted = text.match(/['"]([^'"]+)['"]/)?.[1];
        // Fall back to words between "task" and common prepositions
        const unquoted = text.match(/task\s+([a-z0-9 ]+?)(?:\s+to|\s+from|\s*$)/i)?.[1];
        const fragment = quoted ?? unquoted ?? '';

        if (!fragment) return { success: false, intent, reason: 'Could not identify task name' };

        const { data: taskRow } = await supabase
            .from('tasks')
            .select('id')
            .eq('project_id', projectId)
            .ilike('name', `%${fragment.trim()}%`)
            .limit(1)
            .maybeSingle();

        if (!taskRow) return { success: false, intent, reason: 'No matching task found' };

        const updates: Record<string, string> = {};
        if (intent === 'update_status') updates.status = status;
        if (intent === 'update_priority') updates.priority = priority;

        await supabase.from('tasks').update(updates).eq('id', taskRow.id);
        revalidatePath('/dashboard');
        return { success: true, intent, taskId: taskRow.id };
    }

    return { success: false, intent: 'unknown', reason: 'Could not determine intent from voice command' };
}
