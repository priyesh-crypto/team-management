import { inngest } from "./client";
import type { TaskAssignedEvent, TaskStatusChangedEvent, MemberInvitedEvent, ActivityLogEvent } from "./client";
import { createClient } from "@/utils/supabase/server";

// ── task/assigned ─────────────────────────────────────────────────────────────

export const onTaskAssigned = inngest.createFunction(
    { id: "on-task-assigned", retries: 3, trigger: { event: "task/assigned" } } as any,
    async ({ event }: { event: TaskAssignedEvent }) => {
        const { taskId, taskName, assigneeId, assignerName, orgId } = event.data;
        const supabase = await createClient();

        await supabase.from("notifications").insert({
            user_id: assigneeId,
            org_id:  orgId,
            type:    "task_assigned",
            title:   "New task assigned",
            message: `${assignerName} assigned you "${taskName}"`,
            task_id: taskId,
            is_read: false,
        });
    }
);

// ── task/status-changed ───────────────────────────────────────────────────────

export const onTaskStatusChanged = inngest.createFunction(
    { id: "on-task-status-changed", retries: 3, trigger: { event: "task/status-changed" } } as any,
    async ({ event }: { event: TaskStatusChangedEvent }) => {
        const { taskId, taskName, newStatus, userId, orgId } = event.data;
        const supabase = await createClient();

        await supabase.from("activity_logs").insert({
            org_id:      orgId,
            user_id:     userId,
            action:      "status_changed",
            entity_type: "task",
            entity_id:   taskId,
            metadata:    { taskName, newStatus },
        });
    }
);

// ── member/invited ────────────────────────────────────────────────────────────
// Email delivery runs here — outside the request path — so inviteMember()
// returns in ~5 ms instead of ~500 ms.

export const onMemberInvited = inngest.createFunction(
    { id: "on-member-invited", retries: 3, trigger: { event: "member/invited" } } as any,
    async ({ event }: { event: MemberInvitedEvent }) => {
        const { email, orgName, invitedBy, inviteUrl, role } = event.data;

        if (!process.env.RESEND_API_KEY) return;

        const { Resend } = await import("resend");
        const resend    = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@taskflowpro.com";

        await resend.emails.send({
            from:    fromEmail,
            to:      email,
            subject: `You've been invited to join ${orgName}`,
            html: `
                <div style="font-family:Arial,sans-serif;padding:20px;max-width:600px;margin:0 auto;border:1px solid #e1e1e1;border-radius:12px;">
                    <h2 style="color:#1d1d1f;">You've been invited!</h2>
                    <p>You have been invited to join <strong>${orgName}</strong> as a <strong>${role}</strong> by ${invitedBy}.</p>
                    <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#0051e6;color:#fff;text-decoration:none;border-radius:980px;font-weight:600;font-size:14px;">Accept Invitation</a>
                    <p style="font-size:12px;color:#86868b;margin-top:24px;">Or copy: ${inviteUrl}</p>
                </div>
            `,
        });
    }
);

// ── activity/log ──────────────────────────────────────────────────────────────

export const onActivityLog = inngest.createFunction(
    { id: "on-activity-log", retries: 2, trigger: { event: "activity/log" } } as any,
    async ({ event }: { event: ActivityLogEvent }) => {
        const { orgId, userId, action, entityType, entityId, metadata } = event.data;
        const supabase = await createClient();

        await supabase.from("activity_logs").insert({
            org_id:      orgId,
            user_id:     userId,
            action,
            entity_type: entityType,
            entity_id:   entityId,
            metadata:    metadata ?? {},
        });
    }
);

export const allFunctions = [
    onTaskAssigned,
    onTaskStatusChanged,
    onMemberInvited,
    onActivityLog,
];
