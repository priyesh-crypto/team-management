import { getSystemHealth } from "../actions-tier3";
import { PageHeader, Card, SectionLabel } from "../_components/ui";
import Link from "next/link";

function HealthDot({ ok }: { ok: boolean }) {
    return (
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400 animate-pulse"}`} />
    );
}

export default async function SystemPage() {
    const health = await getSystemHealth();

    const webhookHealthy = health.webhooks.failing === 0;
    const ticketsHealthy = health.support.openTickets < 10;
    const gdprHealthy   = health.gdpr.pendingRequests === 0;

    return (
        <div className="p-10 max-w-5xl space-y-6">
            <PageHeader title="System Health" subtitle="Operational status and key signals." />

            {/* Status grid */}
            <div className="grid grid-cols-2 gap-4">
                {[
                    {
                        label: "Webhooks",
                        ok: webhookHealthy,
                        detail: webhookHealthy
                            ? `${health.webhooks.active} active, no failures`
                            : `${health.webhooks.failing} webhooks failing (${health.webhooks.totalFailures} total errors)`,
                        href: null,
                    },
                    {
                        label: "Organizations",
                        ok: health.orgs.suspended === 0,
                        detail: `${health.orgs.total} total · ${health.orgs.suspended} suspended`,
                        href: "/admin/orgs",
                    },
                    {
                        label: "Support queue",
                        ok: ticketsHealthy,
                        detail: `${health.support.openTickets} open ticket${health.support.openTickets !== 1 ? "s" : ""}`,
                        href: "/admin/support",
                    },
                    {
                        label: "GDPR requests",
                        ok: gdprHealthy,
                        detail: gdprHealthy
                            ? "No pending requests"
                            : `${health.gdpr.pendingRequests} pending request${health.gdpr.pendingRequests !== 1 ? "s" : ""}`,
                        href: "/admin/gdpr",
                    },
                ].map(({ label, ok, detail, href }) => (
                    <Card key={label} className={!ok ? "border-red-200" : ""}>
                        <div className="flex items-center gap-2 mb-2">
                            <HealthDot ok={ok} />
                            <span className="text-sm font-black text-[#1d1d1f]">{label}</span>
                        </div>
                        <p className="text-xs text-[#86868b]">{detail}</p>
                        {href && (
                            <Link href={href} className="text-[10px] font-black text-[#0c64ef] hover:underline mt-2 inline-block">
                                View →
                            </Link>
                        )}
                    </Card>
                ))}
            </div>

            {/* API key usage */}
            <Card>
                <SectionLabel>API key usage</SectionLabel>
                <div className="grid grid-cols-2 gap-6 mt-2">
                    <div>
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#86868b]">Active keys</div>
                        <div className="text-3xl font-black mt-1 text-[#1d1d1f]">{health.apiKeys.active}</div>
                    </div>
                    <div>
                        <div className="text-[9px] font-black uppercase tracking-[0.2em] text-[#86868b]">Used last 7 days</div>
                        <div className="text-3xl font-black mt-1 text-[#0c64ef]">{health.apiKeys.usedLast7Days}</div>
                    </div>
                </div>
                <p className="text-[10px] text-[#86868b] mt-3">
                    {health.apiKeys.active - health.apiKeys.usedLast7Days} key{health.apiKeys.active - health.apiKeys.usedLast7Days !== 1 ? "s" : ""} inactive for 7+ days.
                </p>
            </Card>

            {/* Webhook detail */}
            {!webhookHealthy && (
                <Card className="border-red-200">
                    <SectionLabel>Webhook failures</SectionLabel>
                    <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 mt-2">
                        <p className="text-sm font-black text-red-800">
                            {health.webhooks.failing} webhook{health.webhooks.failing !== 1 ? "s" : ""} are failing
                        </p>
                        <p className="text-xs text-red-700 mt-1">
                            {health.webhooks.totalFailures} cumulative delivery failures. Go to the affected org and reset the webhook endpoint.
                        </p>
                    </div>
                </Card>
            )}

            {/* Recent admin activity */}
            {Object.keys(health.recentActions).length > 0 && (
                <Card>
                    <SectionLabel>Recent admin actions (last 20)</SectionLabel>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                        {Object.entries(health.recentActions)
                            .sort(([, a], [, b]) => b - a)
                            .map(([action, count]) => (
                                <div key={action} className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#f5f5f7]">
                                    <span className="text-xs font-bold text-[#1d1d1f] truncate">{action.replace(/_/g, " ")}</span>
                                    <span className="text-xs font-black text-[#86868b] ml-2 flex-shrink-0">{count}×</span>
                                </div>
                            ))}
                    </div>
                    <Link href="/admin/audit" className="text-[10px] font-black text-[#0c64ef] hover:underline mt-3 inline-block">
                        Full audit log →
                    </Link>
                </Card>
            )}
        </div>
    );
}
