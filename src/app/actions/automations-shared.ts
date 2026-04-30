// Shared types and constants for automations
// Separated from "use server" file so they can be imported by client components

export type AutomationRule = {
    id: string;
    org_id: string;
    created_by: string;
    name: string;
    is_active: boolean;
    trigger_type: string;
    trigger_config: Record<string, unknown>;
    action_type: string;
    action_config: Record<string, unknown>;
    run_count: number;
    last_run_at: string | null;
    created_at: string;
};

export const TRIGGER_TYPES = [
    { id: "task_created", label: "Task created" },
    { id: "task_status_changed", label: "Task status changed" },
    { id: "task_overdue", label: "Task becomes overdue" },
    { id: "comment_added", label: "Comment added" },
    { id: "due_date_approaching", label: "Due date within N days" },
];

export const ACTION_TYPES = [
    { id: "send_notification", label: "Send in-app notification" },
    { id: "send_slack", label: "Send Slack message" },
    { id: "change_status", label: "Change task status" },
    { id: "assign_user", label: "Assign to user" },
    { id: "create_task", label: "Create follow-up task" },
];
