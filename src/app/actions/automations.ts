"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import { sendSlackMessage, buildTaskNotification } from "@/lib/slack";

// Re-export type (types are erased at runtime, so this is fine in "use server")
export type { AutomationRule } from "./automations-shared";
import type { AutomationRule } from "./automations-shared";
// Note: TRIGGER_TYPES and ACTION_TYPES are now in automations-shared.ts
// Import them from "@/app/actions/automations-shared" in client components


async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
    const { data } = await supabase.from("organization_members").select("org_id").eq("user_id", userId).single();
    if (!data) throw new Error("No org");
    return data.org_id;
}

export async function getAutomationRules(): Promise<AutomationRule[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const orgId = await getOrgId(supabase, user.id);
    const { data } = await supabase.from("automation_rules").select("*").eq("org_id", orgId).order("created_at", { ascending: false });
    return (data ?? []) as AutomationRule[];
}

export async function createAutomationRule(input: {
    name: string;
    trigger_type: string;
    trigger_config?: Record<string, unknown>;
    action_type: string;
    action_config?: Record<string, unknown>;
    conditions?: AutomationRule['conditions'];
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");
    const orgId = await getOrgId(supabase, user.id);

    const { error } = await supabase.from("automation_rules").insert({
        org_id: orgId,
        created_by: user.id,
        name: input.name,
        trigger_type: input.trigger_type,
        trigger_config: input.trigger_config ?? {},
        action_type: input.action_type,
        action_config: input.action_config ?? {},
        conditions: input.conditions || [],
    });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}

export async function toggleAutomationRule(id: string, is_active: boolean) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");
    const orgId = await getOrgId(supabase, user.id);
    const { error } = await supabase
        .from("automation_rules")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("org_id", orgId);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}

export async function deleteAutomationRule(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");
    const orgId = await getOrgId(supabase, user.id);
    const { error } = await supabase
        .from("automation_rules")
        .delete()
        .eq("id", id)
        .eq("org_id", orgId);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}

function evaluateConditions(conditions: AutomationRule['conditions'], task: any) {
    if (!conditions || conditions.length === 0) return true;
    if (!task) return false;

    return conditions.every(c => {
        const val = (task as any)[c.field];
        if (val === undefined) return false;

        const taskVal = String(val).toLowerCase();
        const ruleVal = String(c.value).toLowerCase();

        switch (c.operator) {
            case 'eq': return taskVal === ruleVal;
            case 'neq': return taskVal !== ruleVal;
            case 'contains': return taskVal.includes(ruleVal);
            case 'gt': return parseFloat(taskVal) > parseFloat(ruleVal);
            case 'lt': return parseFloat(taskVal) < parseFloat(ruleVal);
            default: return false;
        }
    });
}

export async function fireAutomations(orgId: string, triggerType: string, context: {
    task?: { id: string; name: string; priority: string; status?: string; deadline?: string };
    fromStatus?: string;
    toStatus?: string;
}) {
    const admin = createAdminClient();
    const { data: rules } = await admin
        .from("automation_rules")
        .select("*")
        .eq("org_id", orgId)
        .eq("trigger_type", triggerType)
        .eq("is_active", true);

    if (!rules || rules.length === 0) return;

    for (const rule of rules) {
        try {
            // Check conditions before executing
            if (evaluateConditions((rule as any).conditions, context.task)) {
                await executeAction(admin, orgId, rule as AutomationRule, context);
                await admin.from("automation_rules").update({
                    run_count: (rule.run_count ?? 0) + 1,
                    last_run_at: new Date().toISOString(),
                }).eq("id", rule.id);
            }
        } catch (err) {
            console.error(`[Automations] rule ${rule.id} failed:`, err);
        }
    }
}

const ALLOWED_STATUSES = new Set(["To Do", "In Progress", "In Review", "Blocked", "Completed"]);

async function validateOrgMember(admin: ReturnType<typeof createAdminClient>, orgId: string, userId: string): Promise<boolean> {
    const { data } = await admin
        .from("organization_members")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("user_id", userId)
        .maybeSingle();
    return !!data;
}

async function executeAction(
    admin: ReturnType<typeof createAdminClient>,
    orgId: string,
    rule: AutomationRule,
    context: Parameters<typeof fireAutomations>[2]
) {
    const { task } = context;
    switch (rule.action_type) {
        case "send_notification": {
            if (!task) return;
            const config = rule.action_config as { user_ids?: string[]; message?: string };
            const rawTargets: string[] = config.user_ids ?? [];
            if (rawTargets.length === 0) return;
            // Verify every target user belongs to this org before inserting notifications
            const validChecks = await Promise.all(rawTargets.map(uid => validateOrgMember(admin, orgId, uid)));
            const targets = rawTargets.filter((_, i) => validChecks[i]);
            if (targets.length === 0) {
                console.warn(`[Automations] rule ${rule.id}: all notification targets are outside org ${orgId}`);
                return;
            }
            const msg = config.message ?? `Automation: "${rule.name}" triggered on task "${task.name}"`;
            await admin.from("notifications").insert(
                targets.map(uid => ({
                    org_id: orgId,
                    user_id: uid,
                    type: "system" as const,
                    message: msg,
                    task_id: task.id,
                }))
            );
            break;
        }
        case "send_slack": {
            if (!task) return;
            const { data: integration } = await admin
                .from("org_integrations")
                .select("config")
                .eq("org_id", orgId)
                .eq("provider", "slack")
                .eq("is_active", true)
                .maybeSingle();
            if (!integration?.config) return;
            const config = integration.config as { webhook_url?: string };
            if (!config.webhook_url) return;
            const msg = buildTaskNotification(rule.trigger_type, task);
            await sendSlackMessage(config.webhook_url, msg);
            break;
        }
        case "change_status": {
            if (!task) return;
            const config = rule.action_config as { status?: string };
            if (!config.status) return;
            if (!ALLOWED_STATUSES.has(config.status)) {
                console.warn(`[Automations] rule ${rule.id}: invalid target status "${config.status}"`);
                return;
            }
            // Bind to org_id so a cross-org rule ID can never mutate another org's task
            await admin.from("tasks").update({ status: config.status })
                .eq("id", task.id)
                .eq("org_id", orgId);
            break;
        }
        case "assign_user": {
            if (!task) return;
            const config = rule.action_config as { user_id?: string };
            if (!config.user_id) return;
            const isMember = await validateOrgMember(admin, orgId, config.user_id);
            if (!isMember) {
                console.warn(`[Automations] rule ${rule.id}: target user ${config.user_id} not in org ${orgId}`);
                return;
            }
            // Bind to org_id so a cross-org rule ID can never mutate another org's task
            await admin.from("tasks").update({ employee_id: config.user_id })
                .eq("id", task.id)
                .eq("org_id", orgId);
            break;
        }
        default:
            break;
    }
}
