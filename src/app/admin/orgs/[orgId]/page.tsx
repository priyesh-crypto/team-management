import { notFound } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { OrgDetailClient } from "./OrgDetailClient";

export default async function OrgDetailPage({
    params,
}: {
    params: Promise<{ orgId: string }>;
}) {
    const { orgId } = await params;
    const supabase = await createClient();

    const [{ data: org }, { data: plans }, { data: usage }, { data: members }, { data: actions }] =
        await Promise.all([
            supabase.from("organizations").select("*").eq("id", orgId).single(),
            supabase.from("plans").select("id, name, price_monthly_cents").order("sort_order"),
            supabase.from("org_usage").select("*").eq("org_id", orgId).single(),
            supabase
                .from("organization_members")
                .select("user_id, role, profiles:user_id(full_name, avatar_url)")
                .eq("org_id", orgId),
            supabase
                .from("platform_admin_actions")
                .select("*")
                .eq("target_org_id", orgId)
                .order("created_at", { ascending: false })
                .limit(20),
        ]);

    if (!org) notFound();

    return (
        <OrgDetailClient
            org={org}
            plans={plans ?? []}
            usage={usage ?? { active_seats: 0, project_count: 0, task_count: 0 }}
            members={members ?? []}
            recentActions={actions ?? []}
        />
    );
}
