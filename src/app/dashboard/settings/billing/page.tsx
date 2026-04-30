import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { BillingClient } from "./BillingClient";

type Plan = {
    id: string;
    name: string;
    price_monthly_cents: number;
    seat_limit: number | null;
    project_limit: number | null;
    features: Record<string, boolean>;
    sort_order: number;
};

export default async function BillingPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");

    const { data: membership } = await supabase
        .from("organization_members")
        .select("org_id, role, organizations:org_id(id, name, plan_id, subscription_status, trial_ends_at, current_period_end, seats_purchased, cancel_at_period_end)")
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .limit(1)
        .maybeSingle();

    if (!membership) {
        return (
            <div className="p-8">
                <h1 className="text-2xl font-bold">Billing</h1>
                <p className="mt-4 text-slate-500">
                    Only org owners and admins can manage billing.
                </p>
            </div>
        );
    }

    const org = Array.isArray(membership.organizations)
        ? membership.organizations[0]
        : membership.organizations;

    const { data: plans } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

    const { data: usage } = await supabase
        .from("org_usage")
        .select("*")
        .eq("org_id", org.id)
        .maybeSingle();

    return (
        <BillingClient
            org={org}
            plans={(plans ?? []) as Plan[]}
            usage={usage ?? { active_seats: 0, project_count: 0, task_count: 0 }}
        />
    );
}
