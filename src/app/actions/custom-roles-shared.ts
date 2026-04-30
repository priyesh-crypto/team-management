// Shared types and constants for custom roles
// Separated from "use server" file so they can be imported by client components

export const ALL_PERMISSIONS = [
    "tasks.create", "tasks.edit", "tasks.delete", "tasks.assign",
    "workspaces.create", "workspaces.edit", "workspaces.delete",
    "members.invite", "members.remove",
    "reports.view", "audit.view",
    "integrations.manage", "billing.view",
] as const;

export type Permission = typeof ALL_PERMISSIONS[number];

export type CustomRole = {
    id: string;
    name: string;
    description: string | null;
    permissions: Record<string, boolean>;
    is_system: boolean;
    created_at: string;
};

export type RoleAssignment = {
    id: string;
    user_id: string;
    custom_role_id: string;
    assigned_at: string;
    role_name?: string;
};
