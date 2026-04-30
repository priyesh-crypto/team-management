import Link from "next/link";
import { getOrgActivity } from "../../../actions-tier1";

function fmtDay(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en", { month: "short", day: "numeric" });
}

export default async function OrgUsagePage({
    params,
    searchParams,
}: {
    params: Promise<{ orgId: string }>;
    searchParams: Promise<{ days?: string }>;
}) {
    const { orgId } = await params;
    const { days: daysParam } = await searchParams;
    const days = Math.min(90, Math.max(7, parseInt(daysParam ?? "30", 10) || 30));

    const activity = await getOrgActivity(orgId, days);

    const dates = Object.keys(activity.byDay).sort();
    const maxTasks = Math.max(1, ...dates.map(d => activity.byDay[d].created));

    return (
        <div className="p-10 max-w-5xl space-y-6">
            <div>
                <Link
                    href={`/admin/orgs/${orgId}`}
                    className="text-[10px] font-black uppercase tracking-widest text-[#86868b] hover:text-[#0c64ef] transition"
                >
                    ← Back to org
                </Link>
                <h1 className="text-2xl font-black tracking-tight text-[#1d1d1f] mt-3">Usage Analytics</h1>
            </div>

            {/* Period selector */}
            <div className="flex gap-2">
                {[7, 14, 30, 90].map(d => (
                    <Link
                        key={d}
                        href={`/admin/orgs/${orgId}/usage?days=${d}`}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-colors ${
                            days === d
                                ? "bg-[#0c64ef] text-white"
                                : "bg-[#f5f5f7] text-[#86868b] hover:bg-[#e5e5ea]"
                        }`}
                    >
                        {d}d
                    </Link>
                ))}
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: "Tasks created", value: activity.taskCount },
                    { label: "Comments", value: activity.commentCount },
                    { label: "Members", value: activity.totalMembers },
                ].map(({ label, value }) => (
                    <div key={label} className="bg-white rounded-2xl border border-[#e5e5ea] p-5">
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#86868b]">{label}</div>
                        <div className="text-3xl font-black mt-1.5 tracking-tight text-[#1d1d1f]">{value}</div>
                    </div>
                ))}
            </div>

            {/* Activity chart */}
            <div className="bg-white rounded-2xl border border-[#e5e5ea] p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#86868b] mb-4">
                    Daily task creation — last {days} days
                </p>
                {dates.length === 0 ? (
                    <p className="text-sm text-[#86868b] py-8 text-center">No activity in this period.</p>
                ) : (
                    <div className="flex items-end gap-1 h-32 overflow-x-auto pb-1">
                        {dates.map(d => {
                            const { created, completed } = activity.byDay[d];
                            const heightPct = Math.round((created / maxTasks) * 100);
                            const completedPct = created > 0 ? Math.round((completed / created) * 100) : 0;
                            return (
                                <div key={d} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 28 }}
                                    title={`${fmtDay(d)}: ${created} created, ${completed} completed`}>
                                    <div className="w-5 rounded-t-md overflow-hidden flex flex-col-reverse"
                                        style={{ height: `${Math.max(4, heightPct)}%` }}>
                                        <div className="w-full bg-[#0c64ef]/20 flex-1" />
                                        <div className="w-full bg-[#0c64ef]" style={{ height: `${completedPct}%` }} />
                                    </div>
                                    <span className="text-[8px] text-[#86868b] rotate-45 origin-left mt-1">
                                        {fmtDay(d).split(" ")[1]}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="flex gap-4 mt-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-[#0c64ef]/20" />
                        <span className="text-[10px] text-[#86868b]">Created</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-[#0c64ef]" />
                        <span className="text-[10px] text-[#86868b]">Completed</span>
                    </div>
                </div>
            </div>

            {/* Priority breakdown */}
            {Object.keys(activity.priorityCounts).length > 0 && (
                <div className="bg-white rounded-2xl border border-[#e5e5ea] p-6">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[#86868b] mb-4">
                        Tasks by priority
                    </p>
                    <div className="space-y-2">
                        {Object.entries(activity.priorityCounts)
                            .sort(([, a], [, b]) => b - a)
                            .map(([priority, count]) => {
                                const pct = Math.round((count / activity.taskCount) * 100);
                                const colors: Record<string, string> = {
                                    urgent: "bg-red-400",
                                    high: "bg-orange-400",
                                    medium: "bg-yellow-400",
                                    low: "bg-emerald-400",
                                    none: "bg-slate-300",
                                };
                                return (
                                    <div key={priority} className="flex items-center gap-3">
                                        <span className="text-[11px] font-bold text-[#1d1d1f] w-16 capitalize">{priority}</span>
                                        <div className="flex-1 h-2 rounded-full bg-[#f5f5f7] overflow-hidden">
                                            <div
                                                className={`h-full rounded-full ${colors[priority] ?? "bg-slate-300"}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                        <span className="text-[11px] text-[#86868b] w-12 text-right">{count} ({pct}%)</span>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}
        </div>
    );
}
