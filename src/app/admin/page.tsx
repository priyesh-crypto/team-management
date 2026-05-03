import Link from "next/link";
import { DollarSign, Sparkles, Clock, AlertTriangle, Building2, Users } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import {
    PageHeader,
    StatCard,
    Card,
    SectionLabel,
    StatusPill,
    PlanPill,
    formatMoney,
} from "./_components/ui";

export default async function AdminDashboard() {
    const supabase = await createClient();

    const [
        { data: revenue },
        { count: orgCount },
        { count: userCount },
        { data: recentOrgs },
    ] = await Promise.all([
        supabase.from("platform_revenue_summary").select("*"),
        supabase.from("organizations").select("*", { count: "exact", head: true }),
        supabase.from("organization_members").select("*", { count: "exact", head: true }),
        supabase
            .from("organizations")
            .select("id, name, plan_id, subscription_status, created_at")
            .order("created_at", { ascending: false })
            .limit(6),
    ]);

    const totalMrr = (revenue ?? []).reduce((s, r) => s + Number(r.mrr_cents ?? 0), 0);
    const activeOrgs = (revenue ?? []).reduce((s, r) => s + Number(r.active_count ?? 0), 0);
    const trialingOrgs = (revenue ?? []).reduce((s, r) => s + Number(r.trialing_count ?? 0), 0);
    const pastDue = (revenue ?? []).reduce((s, r) => s + Number(r.past_due_count ?? 0), 0);

    const iconProps = { size: 16, strokeWidth: 2 };

    return (
        <div className="p-8 max-w-7xl">
            <PageHeader title="Overview" subtitle="Subscription and usage at a glance." />

            <div className="grid grid-cols-4 gap-4 mb-4">
                <StatCard label="MRR" value={formatMoney(totalMrr)} accent="emerald" icon={<DollarSign {...iconProps} />} />
                <StatCard label="Active orgs" value={activeOrgs} accent="blue" icon={<Sparkles {...iconProps} />} />
                <StatCard label="Trialing" value={trialingOrgs} accent="amber" icon={<Clock {...iconProps} />} />
                <StatCard label="Past due" value={pastDue} accent="red" icon={<AlertTriangle {...iconProps} />} sub="Needs attention" />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
                <StatCard label="Total organizations" value={orgCount ?? 0} icon={<Building2 {...iconProps} />} />
                <StatCard label="Total users" value={userCount ?? 0} icon={<Users {...iconProps} />} />
            </div>

            <div className="grid grid-cols-3 gap-4">
                <Card className="col-span-2">
                    <SectionLabel>Revenue by plan</SectionLabel>
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs font-medium text-[#86868b] border-b border-[#f0f0f2]">
                                <th className="pb-2.5 font-medium">Plan</th>
                                <th className="pb-2.5 text-center font-medium">Active</th>
                                <th className="pb-2.5 text-center font-medium">Trial</th>
                                <th className="pb-2.5 text-center font-medium">Past due</th>
                                <th className="pb-2.5 text-center font-medium">Seats</th>
                                <th className="pb-2.5 text-right font-medium">MRR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(revenue ?? []).map((r) => (
                                <tr key={r.plan_id} className="border-b border-[#f0f0f2] last:border-0">
                                    <td className="py-3">
                                        <PlanPill plan={r.plan_id} />
                                    </td>
                                    <td className="py-3 text-center text-sm text-[#1d1d1f] tabular-nums">
                                        {r.active_count ?? 0}
                                    </td>
                                    <td className="py-3 text-center text-sm text-[#86868b] tabular-nums">
                                        {r.trialing_count ?? 0}
                                    </td>
                                    <td className="py-3 text-center text-sm text-[#86868b] tabular-nums">
                                        {r.past_due_count ?? 0}
                                    </td>
                                    <td className="py-3 text-center text-sm text-[#86868b] tabular-nums">
                                        {r.active_seats ?? 0}
                                    </td>
                                    <td className="py-3 text-right text-sm font-medium text-[#1d1d1f] tabular-nums">
                                        {formatMoney(Number(r.mrr_cents) || 0)}
                                    </td>
                                </tr>
                            ))}
                            {(revenue ?? []).length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-sm text-[#86868b]">
                                        No data yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </Card>

                <Card>
                    <SectionLabel>Recent organizations</SectionLabel>
                    <div className="space-y-2">
                        {(recentOrgs ?? []).map((o) => (
                            <Link
                                key={o.id}
                                href={`/admin/orgs/${o.id}`}
                                className="flex items-center justify-between p-2.5 rounded-md hover:bg-[#f5f5f7] transition-colors group"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium text-[#1d1d1f] truncate group-hover:text-[#0051e6] transition-colors">
                                        {o.name}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <PlanPill plan={o.plan_id} />
                                        <StatusPill status={o.subscription_status} />
                                    </div>
                                </div>
                            </Link>
                        ))}
                        {(recentOrgs ?? []).length === 0 && (
                            <p className="text-sm text-[#86868b] text-center py-6">No orgs yet.</p>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
