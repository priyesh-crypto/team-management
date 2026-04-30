"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { ALL_PERMISSIONS } from "./custom-roles-shared";
import type { CustomRole, RoleAssignment } from "./custom-roles-shared";

// Re-export types for consumers (types are erased at runtime)
export type { Permission, CustomRole, RoleAssignment } from "./custom-roles-shared";
// Note: ALL_PERMISSIONS is in custom-roles-shared.ts — import it directly from there


export async function getCustomRoles(orgId: string): Promise<CustomRole[]> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("custom_roles")
        .select("id, name, description, permissions, is_system, created_at")
        .eq("org_id", orgId)
        .order("created_at");
    return (data ?? []) as CustomRole[];
}

export async function createCustomRole(orgId: string, name: string, description: string, permissions: string[]) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const permMap = Object.fromEntries(ALL_PERMISSIONS.map(p => [p, permissions.includes(p)]));

    const { data, error } = await supabase
        .from("custom_roles")
        .insert({ org_id: orgId, name, description: description || null, permissions: permMap, created_by: user.id })
        .select("id, name, description, permissions, is_system, created_at")
        .single();

    if (error) return { error: error.message };
    revalidatePath("/dashboard/settings/roles");
    return { data };
}

export async function updateCustomRole(roleId: string, orgId: string, name: string, description: string, permissions: string[]) {
    const supabase = await createClient();
    const permMap = Object.fromEntries(ALL_PERMISSIONS.map(p => [p, permissions.includes(p)]));

    const { error } = await supabase
        .from("custom_roles")
        .update({ name, description: description || null, permissions: permMap })
        .eq("id", roleId)
        .eq("org_id", orgId)
        .eq("is_system", false);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/settings/roles");
    return { ok: true };
}

export async function deleteCustomRole(roleId: string, orgId: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("custom_roles")
        .delete()
        .eq("id", roleId)
        .eq("org_id", orgId)
        .eq("is_system", false);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/settings/roles");
    return { ok: true };
}

export async function getRoleAssignments(orgId: string): Promise<RoleAssignment[]> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("custom_role_assignments")
        .select("id, user_id, custom_role_id, assigned_at, custom_roles(name)")
        .eq("org_id", orgId)
        .order("assigned_at", { ascending: false });

    return ((data ?? []) as unknown as Array<{
        id: string; user_id: string; custom_role_id: string; assigned_at: string;
        custom_roles: { name: string } | null;
    }>).map(r => ({
        id: r.id,
        user_id: r.user_id,
        custom_role_id: r.custom_role_id,
        assigned_at: r.assigned_at,
        role_name: r.custom_roles?.name,
    }));
}

export async function assignRole(orgId: string, userId: string, customRoleId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase
        .from("custom_role_assignments")
        .upsert({ org_id: orgId, user_id: userId, custom_role_id: customRoleId, assigned_by: user.id },
            { onConflict: "org_id,user_id,custom_role_id" });

    if (error) return { error: error.message };
    revalidatePath("/dashboard/settings/roles");
    return { ok: true };
}

export async function unassignRole(assignmentId: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("custom_role_assignments")
        .delete()
        .eq("id", assignmentId);

    if (error) return { error: error.message };
    revalidatePath("/dashboard/settings/roles");
    return { ok: true };
}
