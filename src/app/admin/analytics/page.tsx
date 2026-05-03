import { getFunnelData, getCohortData } from "../actions-tier2";
import { PageHeader, Card, SectionLabel } from "../_components/ui";

function pct(n: number, total: number) {
    return total > 0 ? Math.round((n / total) * 100) : 0;
}

function fmtMonth(m: string) {
    return new Date(m + "-01T00:00:00").toLocaleDateString("en", { month: "short", year: "2-digit" });
}

export default async function AnalyticsPage() {
    const [funnel, cohorts] = await Promise.all([getFunnelData(), getCohortData()]);

    const signupDays = Object.keys(funnel.signupsByDay).sort();
    const maxSignups = Math.max(1, ...Object.values(funnel.signupsByDay));

    return (
        <div className="p-10 max-w-6xl space-y-6">
            <PageHeader title="Analytics" subtitle="Funnel conversion and cohort retention." />

            {/* Funnel */}
            <div className="grid grid-cols-5 gap-3">
                {[
                    { label: "Total orgs", value: funnel.total, color: "bg-[#f5f5f7]", text: "text-[#1d1d1f]" },
                    { label: "Free tier", value: funnel.free, sub: `${pct(funnel.free, funnel.total)}%`, color: "bg-slate-50", text: "text-slate-600" },
                    { label: "Trialing", value: funnel.trialing, sub: `${pct(funnel.trialing, funnel.total)}%`, color: "bg-amber-50", text: "text-amber-700" },
                    { label: "Active (paid)", value: funnel.active, sub: `${pct(funnel.active, funnel.total)}%`, color: "bg-emerald-50", text: "text-emerald-700" },
                    { label: "Churned", value: funnel.canceled, sub: `${pct(funnel.canceled, funnel.total)}%`, color: "bg-red-50", text: "text-red-700" },
                ].map(({ label, value, sub, color, text }) => (
                    <div key={label} className={`rounded-2xl border border-[#e5e5ea] ${color} p-5`}>
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#86868b]">{label}</div>
                        <div className={`text-3xl font-black mt-1.5 ${text}`}>{value}</div>
                        {sub && <div className="text-[10px] font-bold text-[#86868b] mt-1">{sub} of total</div>}
                    </div>
                ))}
            </div>

            {/* Conversion rates */}
            <div className="grid grid-cols-2 gap-4">
                <Card>
                    <SectionLabel>Trial → Paid conversion</SectionLabel>
                    <div className="flex items-end gap-4 mt-2">
                        <div className="text-5xl font-black text-[#0051e6]">{funnel.trialToActiveRate}%</div>
                        <div className="text-sm text-[#86868b] pb-1">
                            {funnel.active} paid of {funnel.trialing + funnel.active} ever-trialed
                        </div>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-[#f5f5f7] overflow-hidden">
                        <div className="h-full rounded-full bg-[#0051e6]" style={{ width: `${funnel.trialToActiveRate}%` }} />
                    </div>
                </Card>
                <Card>
                    <SectionLabel>Churn rate (ever-paid)</SectionLabel>
                    <div className="flex items-end gap-4 mt-2">
                        <div className="text-5xl font-black text-red-500">{funnel.churnRate}%</div>
                        <div className="text-sm text-[#86868b] pb-1">
                            {funnel.canceled} churned of {funnel.active + funnel.canceled} ever-paid
                        </div>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-[#f5f5f7] overflow-hidden">
                        <div className="h-full rounded-full bg-red-400" style={{ width: `${funnel.churnRate}%` }} />
                    </div>
                </Card>
            </div>

            {/* Signups chart */}
            <Card>
                <SectionLabel>New signups — last 30 days</SectionLabel>
                {signupDays.length === 0 ? (
                    <p className="text-sm text-[#86868b] py-6 text-center">No signups in the last 30 days.</p>
                ) : (
                    <div className="flex items-end gap-1.5 h-28 mt-4 overflow-x-auto">
                        {signupDays.map(d => {
                            const count = funnel.signupsByDay[d];
                            const h = Math.max(4, Math.round((count / maxSignups) * 100));
                            return (
                                <div key={d} className="flex flex-col items-center gap-1 flex-shrink-0" style={{ minWidth: 24 }}
                                    title={`${d}: ${count} signups`}>
                                    <span className="text-[9px] font-bold text-[#0051e6]">{count > 0 ? count : ""}</span>
                                    <div className="w-4 rounded-t bg-[#0051e6]/80" style={{ height: `${h}%` }} />
                                    <span className="text-[8px] text-[#86868b]">{new Date(d + "T00:00:00").getDate()}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {/* Cohort retention */}
            <Card>
                <SectionLabel>Cohort retention — by signup month</SectionLabel>
                <p className="text-[10px] text-[#86868b] mb-4">
                    % of orgs from each signup cohort currently on an active paid plan.
                </p>
                {cohorts.length === 0 ? (
                    <p className="text-sm text-[#86868b] py-4 text-center">No data yet.</p>
                ) : (
                    <div className="space-y-2">
                        {cohorts.slice(-12).map(c => {
                            const activeColor =
                                c.activeRate >= 60 ? "bg-emerald-400" :
                                c.activeRate >= 30 ? "bg-amber-400" :
                                "bg-red-400";
                            return (
                                <div key={c.month} className="flex items-center gap-3">
                                    <span className="text-[11px] font-black text-[#1d1d1f] w-14 flex-shrink-0">
                                        {fmtMonth(c.month)}
                                    </span>
                                    <div className="flex-1 h-2.5 rounded-full bg-[#f5f5f7] overflow-hidden">
                                        <div className={`h-full rounded-full ${activeColor}`}
                                            style={{ width: `${c.activeRate}%` }} />
                                    </div>
                                    <div className="text-[10px] text-[#86868b] w-32 text-right flex-shrink-0">
                                        <span className="font-black text-[#1d1d1f]">{c.active}</span> paid ·{" "}
                                        <span className="font-black text-amber-600">{c.trialing}</span> trial ·{" "}
                                        <span className="text-red-400 font-bold">{c.canceled}</span> churned
                                    </div>
                                    <span className={`text-[10px] font-black w-10 text-right ${
                                        c.activeRate >= 60 ? "text-emerald-600" :
                                        c.activeRate >= 30 ? "text-amber-600" : "text-red-500"
                                    }`}>
                                        {c.activeRate}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </div>
    );
}
