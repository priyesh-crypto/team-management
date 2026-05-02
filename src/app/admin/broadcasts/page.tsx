import Link from "next/link";
import { Plus, Target, CalendarClock, AlertTriangle } from "lucide-react";
import { getBroadcasts, getBroadcastStats } from "../actions-tier2";
import { PageHeader, Card } from "../_components/ui";
import { BroadcastDeleteButton } from "./BroadcastDeleteButton";
import { ResendBroadcastButton } from "./ResendBroadcastButton";

export default async function BroadcastsPage() {
    const broadcasts = await getBroadcasts();

    // Pull stats in parallel
    const stats = await Promise.all(
        broadcasts.map(b => getBroadcastStats(b.id).then(s => [b.id, s] as const))
    );
    const statsById = Object.fromEntries(stats);

    return (
        <div className="p-8 max-w-5xl space-y-5">
            <PageHeader
                title="Broadcasts"
                subtitle="Send in-app announcements to your customers."
                actions={
                    <Link
                        href="/admin/broadcasts/new"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#0c64ef] text-white text-sm font-medium hover:bg-[#0950c4] transition-colors"
                    >
                        <Plus size={14} strokeWidth={2.5} />
                        New broadcast
                    </Link>
                }
            />

            {broadcasts.length === 0 ? (
                <Card>
                    <p className="text-sm text-[#86868b] text-center py-8">
                        No broadcasts yet.{" "}
                        <Link href="/admin/broadcasts/new" className="text-[#0c64ef] font-medium hover:underline">
                            Create one
                        </Link>
                    </p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {broadcasts.map(b => {
                        const targetFilter = b.target_filter as { all?: boolean; plans?: string[]; min_seats?: number } | null;
                        const targetLabel =
                            targetFilter?.all ? "All orgs" :
                            targetFilter?.plans?.length ? `Plans: ${targetFilter.plans.join(", ")}` :
                            "Custom filter";

                        const s = statsById[b.id] ?? { total: 0, read: 0, clicked: 0 };
                        const readPct = s.total > 0 ? Math.round((s.read / s.total) * 100) : 0;

                        return (
                            <Card key={b.id} padding="p-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <h3 className="text-sm font-medium text-[#1d1d1f]">{b.title}</h3>
                                            {b.sent_at ? (
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">Sent</span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-medium">Draft</span>
                                            )}
                                            {(b.channels as string[]).map(ch => (
                                                <span key={ch} className="px-2 py-0.5 rounded-full bg-[#0c64ef]/10 text-[#0c64ef] text-[11px] font-medium capitalize">
                                                    {ch}
                                                </span>
                                            ))}
                                        </div>
                                        <p className="text-sm text-[#86868b] mt-1 line-clamp-2">{b.body}</p>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-[#86868b] flex-wrap">
                                            <span className="inline-flex items-center gap-1"><Target size={12} strokeWidth={2} /> {targetLabel}</span>
                                            {b.sent_at && (
                                                <span className="inline-flex items-center gap-1">
                                                    <CalendarClock size={12} strokeWidth={2} />
                                                    Sent {new Date(b.sent_at).toLocaleDateString()}
                                                </span>
                                            )}
                                            <span>Created {new Date(b.created_at).toLocaleDateString()}</span>
                                        </div>

                                        {b.sent_at && (
                                            <div className="flex items-center gap-5 mt-3 pt-3 border-t border-[#f0f0f2]">
                                                <div>
                                                    <div className="text-xs text-[#86868b]">Recipients</div>
                                                    <div className="text-sm font-medium text-[#1d1d1f] mt-0.5 tabular-nums">{s.total}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-[#86868b]">Read</div>
                                                    <div className="text-sm font-medium text-emerald-600 mt-0.5 tabular-nums">
                                                        {s.read} <span className="text-xs text-[#86868b]">({readPct}%)</span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-[#86868b]">Clicked</div>
                                                    <div className="text-sm font-medium text-[#0c64ef] mt-0.5 tabular-nums">{s.clicked}</div>
                                                </div>
                                                {s.total === 0 && (
                                                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 ml-auto">
                                                        <AlertTriangle size={12} strokeWidth={2} />
                                                        No deliveries logged
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {b.sent_at && <ResendBroadcastButton broadcastId={b.id} />}
                                        <BroadcastDeleteButton broadcastId={b.id} />
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
