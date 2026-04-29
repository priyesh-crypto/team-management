import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import {
    PageHeader,
    Card,
    StatusPill,
    PlanPill,
    Input,
    Select,
    Button,
} from "../_components/ui";

export default async function OrgsListPage({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; status?: string; plan?: string }>;
}) {
    const params = await searchParams;
    const supabase = await createClient();

    let query = supabase
        .from("organizations")
        .select(
            "id, name, plan_id, subscription_status, seats_purchased, current_period_end, trial_ends_at, created_at, billing_country, org_usage(active_seats, project_count, task_count)"
        )
        .order("created_at", { ascending: false })
        .limit(200);

    if (params.q) query = query.ilike("name", `%${params.q}%`);
    if (params.status) query = query.eq("subscription_status", params.status);
    if (params.plan) query = query.eq("plan_id", params.plan);

    const { data: orgs } = await query;

    return (
        <div className="p-10 max-w-7xl">
            <PageHeader
                title="Organizations"
                subtitle={`${orgs?.length ?? 0} customer organizations`}
            />

            <Card className="mb-6" padding="p-4">
                <form className="flex gap-2 items-center">
                    <Input
                        name="q"
                        defaultValue={params.q ?? ""}
                        placeholder="Search by name…"
                    />
                    <Select name="plan" defaultValue={params.plan ?? ""} className="!w-44">
                        <option value="">All plans</option>
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="business">Business</option>
                    </Select>
                    <Select name="status" defaultValue={params.status ?? ""} className="!w-44">
                        <option value="">All statuses</option>
                        <option value="trialing">Trialing</option>
                        <option value="active">Active</option>
                        <option value="past_due">Past due</option>
                        <option value="canceled">Canceled</option>
                    </Select>
                    <Button type="submit">Filter</Button>
                </form>
            </Card>

            <Card padding="p-0">
                <table className="w-full">
                    <thead>
                        <tr className="text-left text-[9px] font-black uppercase tracking-[0.15em] text-[#86868b] border-b border-[#f5f5f7]">
                            <th className="px-6 py-4">Organization</th>
                            <th className="px-6 py-4">Plan</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-center">Seats</th>
                            <th className="px-6 py-4 text-center">Projects</th>
                            <th className="px-6 py-4">Region</th>
                            <th className="px-6 py-4">Period ends</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {(orgs ?? []).map((o) => {
                            const usage = Array.isArray(o.org_usage) ? o.org_usage[0] : o.org_usage;
                            const periodEnd = o.current_period_end ?? o.trial_ends_at;
                            return (
                                <tr
                                    key={o.id}
                                    className="border-b border-[#f5f5f7] last:border-0 hover:bg-[#f5f5f7]/40 transition group"
                                >
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-black text-[#1d1d1f]">
                                            {o.name}
                                        </div>
                                        <div className="text-[10px] text-[#86868b] font-mono mt-0.5 truncate max-w-[200px]">
                                            {o.id.slice(0, 8)}…
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <PlanPill plan={o.plan_id} />
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusPill status={o.subscription_status} />
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm font-bold tabular-nums">
                                        <span className="text-[#1d1d1f]">{usage?.active_seats ?? 0}</span>
                                        <span className="text-[#86868b]"> / {o.seats_purchased}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center text-sm font-bold text-[#1d1d1f] tabular-nums">
                                        {usage?.project_count ?? 0}
                                    </td>
                                    <td className="px-6 py-4 text-xs font-bold text-[#86868b]">
                                        {o.billing_country ?? "—"}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-[#86868b]">
                                        {periodEnd ? new Date(periodEnd).toLocaleDateString() : "—"}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Link
                                            href={`/admin/orgs/${o.id}`}
                                            className="text-[10px] font-black uppercase tracking-widest text-[#0c64ef] hover:underline"
                                        >
                                            Manage →
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                        {(orgs ?? []).length === 0 && (
                            <tr>
                                <td colSpan={8} className="py-16 text-center text-sm text-[#86868b]">
                                    No organizations match your filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}
