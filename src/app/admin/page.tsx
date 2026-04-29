import Link from "next/link";
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

    return (
        <div className="p-10 max-w-7xl">
            <PageHeader title="Overview" subtitle="Subscription and usage at a glance." />

            <div className="grid grid-cols-4 gap-4 mb-6">
                <StatCard label="MRR" value={formatMoney(totalMrr)} accent="emerald" icon="💰" />
                <StatCard label="Active orgs" value={activeOrgs} accent="blue" icon="✨" />
                <StatCard label="Trialing" value={trialingOrgs} accent="amber" icon="⏳" />
                <StatCard label="Past due" value={pastDue} accent="red" icon="⚠️" sub="Needs attention" />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <StatCard label="Total organizations" value={orgCount ?? 0} icon="🏢" />
                <StatCard label="Total users" value={userCount ?? 0} icon="👥" />
            </div>

            <div className="grid grid-cols-3 gap-4">
                <Card className="col-span-2">
                    <SectionLabel>Revenue by plan</SectionLabel>
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-[9px] font-black uppercase tracking-[0.15em] text-[#86868b] border-b border-[#f5f5f7]">
                                <th className="pb-3">Plan</th>
                                <th className="pb-3 text-center">Active</th>
                                <th className="pb-3 text-center">Trial</th>
                                <th className="pb-3 text-center">Past Due</th>
                                <th className="pb-3 text-center">Seats</th>
                                <th className="pb-3 text-right">MRR</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(revenue ?? []).map((r) => (
                                <tr key={r.plan_id} className="border-b border-[#f5f5f7] last:border-0">
                                    <td className="py-3.5">
                                        <PlanPill plan={r.plan_id} />
                                    </td>
                                    <td className="py-3.5 text-center text-sm font-bold text-[#1d1d1f] tabular-nums">
                                        {r.active_count ?? 0}
                                    </td>
                                    <td className="py-3.5 text-center text-sm font-bold text-[#86868b] tabular-nums">
                                        {r.trialing_count ?? 0}
                                    </td>
                                    <td className="py-3.5 text-center text-sm font-bold text-[#86868b] tabular-nums">
                                        {r.past_due_count ?? 0}
                                    </td>
                                    <td className="py-3.5 text-center text-sm font-bold text-[#86868b] tabular-nums">
                                        {r.active_seats ?? 0}
                                    </td>
                                    <td className="py-3.5 text-right text-sm font-black text-[#0c64ef] tabular-nums">
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
                                className="flex items-center justify-between p-3 rounded-xl hover:bg-[#f5f5f7] transition group"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-black text-[#1d1d1f] truncate group-hover:text-[#0c64ef] transition">
                                        {o.name}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
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
