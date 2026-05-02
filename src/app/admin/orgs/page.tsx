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
        <div className="p-8 max-w-7xl">
            <PageHeader
                title="Organizations"
                subtitle={`${orgs?.length ?? 0} customer organizations`}
            />

            <Card className="mb-4" padding="p-3">
                <form className="flex gap-2 items-center">
                    <Input
                        name="q"
                        defaultValue={params.q ?? ""}
                        placeholder="Search by name…"
                    />
                    <Select name="plan" defaultValue={params.plan ?? ""} className="!w-40">
                        <option value="">All plans</option>
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="business">Business</option>
                    </Select>
                    <Select name="status" defaultValue={params.status ?? ""} className="!w-40">
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
                        <tr className="text-left text-xs font-medium text-[#86868b] border-b border-[#f0f0f2]">
                            <th className="px-5 py-3 font-medium">Organization</th>
                            <th className="px-5 py-3 font-medium">Plan</th>
                            <th className="px-5 py-3 font-medium">Status</th>
                            <th className="px-5 py-3 text-center font-medium">Seats</th>
                            <th className="px-5 py-3 text-center font-medium">Projects</th>
                            <th className="px-5 py-3 font-medium">Region</th>
                            <th className="px-5 py-3 font-medium">Period ends</th>
                            <th className="px-5 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {(orgs ?? []).map((o) => {
                            const usage = Array.isArray(o.org_usage) ? o.org_usage[0] : o.org_usage;
                            const periodEnd = o.current_period_end ?? o.trial_ends_at;
                            return (
                                <tr
                                    key={o.id}
                                    className="border-b border-[#f0f0f2] last:border-0 hover:bg-[#fafafa] transition-colors"
                                >
                                    <td className="px-5 py-3">
                                        <div className="text-sm font-medium text-[#1d1d1f]">
                                            {o.name}
                                        </div>
                                        <div className="text-xs text-[#86868b] font-mono mt-0.5 truncate max-w-[200px]">
                                            {o.id.slice(0, 8)}…
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <PlanPill plan={o.plan_id} />
                                    </td>
                                    <td className="px-5 py-3">
                                        <StatusPill status={o.subscription_status} />
                                    </td>
                                    <td className="px-5 py-3 text-center text-sm tabular-nums">
                                        <span className="text-[#1d1d1f] font-medium">{usage?.active_seats ?? 0}</span>
                                        <span className="text-[#86868b]"> / {o.seats_purchased}</span>
                                    </td>
                                    <td className="px-5 py-3 text-center text-sm font-medium text-[#1d1d1f] tabular-nums">
                                        {usage?.project_count ?? 0}
                                    </td>
                                    <td className="px-5 py-3 text-sm text-[#52525b]">
                                        {o.billing_country ?? "—"}
                                    </td>
                                    <td className="px-5 py-3 text-sm text-[#52525b]">
                                        {periodEnd ? new Date(periodEnd).toLocaleDateString() : "—"}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <Link
                                            href={`/admin/orgs/${o.id}`}
                                            className="text-sm font-medium text-[#0c64ef] hover:underline"
                                        >
                                            Manage →
                                        </Link>
                                    </td>
                                </tr>
                            );
                        })}
                        {(orgs ?? []).length === 0 && (
                            <tr>
                                <td colSpan={8} className="py-12 text-center text-sm text-[#86868b]">
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
