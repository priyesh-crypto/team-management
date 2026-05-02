import Link from "next/link";
import { Building2 } from "lucide-react";
import { getSupportTickets } from "../actions-tier3";
import { PageHeader, Card } from "../_components/ui";
import { NewTicketForm } from "./NewTicketForm";

const STATUS_STYLES: Record<string, string> = {
    open:        "bg-emerald-50 text-emerald-700",
    in_progress: "bg-[#0c64ef]/10 text-[#0c64ef]",
    resolved:    "bg-slate-100 text-slate-500",
    closed:      "bg-[#f5f5f7] text-[#86868b]",
};

const PRIORITY_STYLES: Record<string, string> = {
    urgent: "bg-red-50 text-red-700",
    high:   "bg-orange-50 text-orange-700",
    normal: "bg-slate-50 text-slate-600",
    low:    "bg-[#f5f5f7] text-[#86868b]",
};

export default async function SupportPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string }>;
}) {
    const { status = "open" } = await searchParams;
    const tickets = await getSupportTickets(status);

    return (
        <div className="p-8 max-w-5xl space-y-5">
            <PageHeader title="Support tickets" subtitle="Track and respond to customer issues." />

            <NewTicketForm />

            {/* Status filter tabs */}
            <div className="flex gap-1.5">
                {["open", "in_progress", "resolved", "closed", "all"].map(s => (
                    <Link
                        key={s}
                        href={`/admin/support?status=${s}`}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                            status === s
                                ? "bg-[#0c64ef] text-white"
                                : "bg-[#f5f5f7] text-[#52525b] hover:bg-[#e5e5ea]"
                        }`}
                    >
                        {s.replace("_", " ")}
                    </Link>
                ))}
            </div>

            {tickets.length === 0 ? (
                <Card>
                    <p className="text-sm text-[#86868b] text-center py-6">
                        No {status !== "all" ? status.replace("_", " ") : ""} tickets.
                    </p>
                </Card>
            ) : (
                <div className="space-y-2">
                    {tickets.map(t => (
                        <Link key={t.id} href={`/admin/support/${t.id}`}
                            className="block bg-white rounded-lg border border-[#e5e5ea] p-4 hover:border-[#0c64ef]/30 transition-colors group">
                            <div className="flex items-start gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <h3 className="text-sm font-medium text-[#1d1d1f] group-hover:text-[#0c64ef] transition-colors">
                                            {t.subject}
                                        </h3>
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${STATUS_STYLES[t.status] ?? "bg-[#f5f5f7] text-[#86868b]"}`}>
                                            {t.status.replace("_", " ")}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${PRIORITY_STYLES[t.priority] ?? ""}`}>
                                            {t.priority}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-1.5 text-xs text-[#86868b]">
                                        {t.organizations && (
                                            <span className="inline-flex items-center gap-1">
                                                <Building2 size={12} strokeWidth={2} />
                                                {t.organizations.name}
                                            </span>
                                        )}
                                        <span>Created {new Date(t.created_at).toLocaleDateString()}</span>
                                        <span>Updated {new Date(t.updated_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <span className="text-[#86868b]">→</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
