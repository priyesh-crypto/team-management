import { notFound } from "next/navigation";
import { createAdminClient } from "@/utils/supabase/admin";
import { OrgDetailClient } from "./OrgDetailClient";
import { getOrgCredits, getFeatureOverrides } from "../../actions-tier1";

export default async function OrgDetailPage({
    params,
}: {
    params: Promise<{ orgId: string }>;
}) {
    const { orgId } = await params;
    const admin = createAdminClient();

    const [
        { data: org },
        { data: plans },
        { data: usage },
        { data: members },
        { data: actions },
        credits,
        featureOverrides,
    ] = await Promise.all([
        admin.from("organizations").select("*").eq("id", orgId).single(),
        admin.from("plans").select("id, name, price_monthly_cents").order("sort_order"),
        admin.from("org_usage").select("*").eq("org_id", orgId).single(),
        admin
            .from("organization_members")
            .select("user_id, role, profiles:user_id(full_name, avatar_url)")
            .eq("org_id", orgId),
        admin
            .from("platform_admin_actions")
            .select("*")
            .eq("target_org_id", orgId)
            .order("created_at", { ascending: false })
            .limit(20),
        getOrgCredits(orgId),
        getFeatureOverrides(orgId),
    ]);

    if (!org) notFound();

    return (
        <OrgDetailClient
            org={org}
            plans={plans ?? []}
            usage={usage ?? { active_seats: 0, project_count: 0, task_count: 0 }}
            members={members ?? []}
            recentActions={actions ?? []}
            credits={credits}
            featureOverrides={featureOverrides}
        />
    );
}
