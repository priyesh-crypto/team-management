import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";
import { getTicketThread } from "../../actions-tier3";
import { Card } from "../../_components/ui";
import { TicketClient } from "./TicketClient";

const PRIORITY_STYLES: Record<string, string> = {
    urgent: "bg-red-50 text-red-700",
    high:   "bg-orange-50 text-orange-700",
    normal: "bg-slate-50 text-slate-600",
    low:    "bg-[#f5f5f7] text-[#86868b]",
};

export default async function TicketPage({
    params,
}: {
    params: Promise<{ ticketId: string }>;
}) {
    const { ticketId } = await params;
    const { ticket, messages } = await getTicketThread(ticketId);

    if (!ticket) notFound();

    return (
        <div className="p-8 max-w-3xl space-y-5">
            <div>
                <Link
                    href="/admin/support"
                    className="inline-flex items-center gap-1 text-xs text-[#86868b] hover:text-[#0c64ef] transition-colors"
                >
                    <ArrowLeft size={12} strokeWidth={2} />
                    Support tickets
                </Link>
            </div>

            <Card>
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight text-[#1d1d1f]">{ticket.subject}</h1>
                        <div className="flex items-center gap-2 mt-2">
                            {ticket.organizations && (
                                <Link href={`/admin/orgs/${ticket.org_id}`}
                                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0c64ef] hover:underline">
                                    <Building2 size={12} strokeWidth={2} />
                                    {ticket.organizations.name}
                                </Link>
                            )}
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${PRIORITY_STYLES[ticket.priority] ?? ""}`}>
                                {ticket.priority}
                            </span>
                            <span className="text-[10px] text-[#86868b]">
                                Created {new Date(ticket.created_at).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>
            </Card>

            <TicketClient
                ticketId={ticket.id}
                currentStatus={ticket.status}
                initialMessages={messages}
            />
        </div>
    );
}
