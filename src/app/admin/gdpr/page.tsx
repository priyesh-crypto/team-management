import { Package, Lock, type LucideIcon } from "lucide-react";
import { getGdprRequests as fetchRequests } from "../actions-tier3";
import { PageHeader, Card, SectionLabel } from "../_components/ui";
import { GdprClient } from "./GdprClient";

const STATUS_STYLES: Record<string, string> = {
    pending:    "bg-amber-50 text-amber-700",
    processing: "bg-blue-50 text-[#0c64ef]",
    completed:  "bg-emerald-50 text-emerald-700",
    failed:     "bg-red-50 text-red-600",
};

const TYPE_ICON: Record<string, LucideIcon> = {
    export:    Package,
    anonymize: Lock,
};

export default async function GdprPage() {
    const requests = await fetchRequests();

    return (
        <div className="p-8 max-w-5xl space-y-5">
            <PageHeader
                title="GDPR compliance"
                subtitle="Data export and right-to-be-forgotten requests."
            />

            <GdprClient />

            <Card>
                <SectionLabel>Request history</SectionLabel>
                {requests.length === 0 ? (
                    <p className="text-sm text-[#86868b] text-center py-6">No GDPR requests yet.</p>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-xs font-medium text-[#86868b] border-b border-[#f0f0f2]">
                                <th className="pb-2.5 font-medium">Type</th>
                                <th className="pb-2.5 font-medium">Org</th>
                                <th className="pb-2.5 font-medium">User ID</th>
                                <th className="pb-2.5 text-center font-medium">Status</th>
                                <th className="pb-2.5 font-medium">Requested</th>
                                <th className="pb-2.5 font-medium">Download</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map(r => {
                                const Icon = TYPE_ICON[r.type];
                                return (
                                    <tr key={r.id} className="border-b border-[#f0f0f2] last:border-0 hover:bg-[#fafafa]">
                                        <td className="py-3 text-sm">
                                            <span className="inline-flex items-center gap-1.5 font-medium capitalize text-[#1d1d1f]">
                                                {Icon && <Icon size={14} strokeWidth={2} />}
                                                {r.type}
                                            </span>
                                        </td>
                                        <td className="py-3 text-sm text-[#52525b]">
                                            {r.organizations?.name ?? r.org_id?.slice(0, 8) ?? "—"}
                                        </td>
                                        <td className="py-3 text-xs font-mono text-[#86868b]">
                                            {r.user_id.slice(0, 12)}…
                                        </td>
                                        <td className="py-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${STATUS_STYLES[r.status] ?? "bg-[#f5f5f7] text-[#86868b]"}`}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td className="py-3 text-xs text-[#86868b]">
                                            {new Date(r.requested_at).toLocaleDateString()}
                                        </td>
                                        <td className="py-3">
                                            {r.file_url ? (
                                                <a
                                                    href={r.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs font-medium text-[#0c64ef] hover:underline"
                                                >
                                                    Download ↗
                                                </a>
                                            ) : (
                                                <span className="text-xs text-[#86868b]">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </Card>
        </div>
    );
}
