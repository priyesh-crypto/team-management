import Link from "next/link";
import { getBroadcasts } from "../actions-tier2";
import { PageHeader, Card } from "../_components/ui";
import { BroadcastDeleteButton } from "./BroadcastDeleteButton";

export default async function BroadcastsPage() {
    const broadcasts = await getBroadcasts();

    return (
        <div className="p-10 max-w-5xl space-y-6">
            <PageHeader
                title="Broadcasts"
                subtitle="Send in-app announcements to your customers."
                actions={
                    <Link
                        href="/admin/broadcasts/new"
                        className="px-4 py-2.5 rounded-xl bg-[#0c64ef] text-white text-[11px] font-black uppercase tracking-wider hover:bg-[#005bb7] transition-colors"
                    >
                        + New broadcast
                    </Link>
                }
            />

            {broadcasts.length === 0 ? (
                <Card>
                    <p className="text-sm text-[#86868b] text-center py-8">
                        No broadcasts yet.{" "}
                        <Link href="/admin/broadcasts/new" className="text-[#0c64ef] font-bold hover:underline">
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

                        return (
                            <Card key={b.id} padding="p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-sm font-black text-[#1d1d1f]">{b.title}</h3>
                                            {b.sent_at ? (
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase">Sent</span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[9px] font-black uppercase">Draft</span>
                                            )}
                                            {(b.channels as string[]).map(ch => (
                                                <span key={ch} className="px-2 py-0.5 rounded-full bg-[#0c64ef]/10 text-[#0c64ef] text-[9px] font-black uppercase">
                                                    {ch}
                                                </span>
                                            ))}
                                        </div>
                                        <p className="text-xs text-[#86868b] mt-1 line-clamp-2">{b.body}</p>
                                        <div className="flex items-center gap-3 mt-2 text-[10px] text-[#86868b]">
                                            <span>🎯 {targetLabel}</span>
                                            {b.sent_at && <span>📅 Sent {new Date(b.sent_at).toLocaleDateString()}</span>}
                                            <span>Created {new Date(b.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <BroadcastDeleteButton broadcastId={b.id} />
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
