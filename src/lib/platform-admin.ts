import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export async function requirePlatformAdmin() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data, error } = await supabase.rpc("is_platform_admin");
    if (error) throw error;
    if (!data) throw new Error("Forbidden: not a platform admin");

    return user;
}

export async function logAdminAction(
    adminUserId: string,
    action: string,
    targetOrgId: string | null,
    payload: Record<string, unknown>
) {
    const admin = createAdminClient();
    await admin.from("platform_admin_actions").insert({
        admin_user_id: adminUserId,
        action,
        target_org_id: targetOrgId,
        payload,
    });
}
