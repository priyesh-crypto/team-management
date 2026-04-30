import { getGdprRequests as fetchRequests } from "../actions-tier3";
import { PageHeader, Card } from "../_components/ui";
import { GdprClient } from "./GdprClient";

const STATUS_STYLES: Record<string, string> = {
    pending:    "bg-amber-50 text-amber-700",
    processing: "bg-blue-50 text-[#0c64ef]",
    completed:  "bg-emerald-50 text-emerald-700",
    failed:     "bg-red-50 text-red-600",
};

const TYPE_ICON: Record<string, string> = {
    export:    "📦",
    anonymize: "🔒",
};

export default async function GdprPage() {
    const requests = await fetchRequests();

    return (
        <div className="p-10 max-w-5xl space-y-6">
            <PageHeader
                title="GDPR Compliance"
                subtitle="Data export and right-to-be-forgotten requests."
            />

            <GdprClient />

            <Card>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#86868b] mb-4">
                    Request history
                </div>
                {requests.length === 0 ? (
                    <p className="text-sm text-[#86868b] text-center py-6">No GDPR requests yet.</p>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-[9px] font-black uppercase tracking-[0.15em] text-[#86868b] border-b border-[#f5f5f7]">
                                <th className="pb-3">Type</th>
                                <th className="pb-3">Org</th>
                                <th className="pb-3">User ID</th>
                                <th className="pb-3 text-center">Status</th>
                                <th className="pb-3">Requested</th>
                                <th className="pb-3">Download</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.map(r => (
                                <tr key={r.id} className="border-b border-[#f5f5f7] last:border-0 hover:bg-[#f5f5f7]/50">
                                    <td className="py-3 text-sm">
                                        <span title={r.type}>{TYPE_ICON[r.type]}</span>{" "}
                                        <span className="font-bold capitalize text-[#1d1d1f]">{r.type}</span>
                                    </td>
                                    <td className="py-3 text-xs text-[#86868b]">
                                        {r.organizations?.name ?? r.org_id?.slice(0, 8) ?? "—"}
                                    </td>
                                    <td className="py-3 text-[10px] font-mono text-[#86868b]">
                                        {r.user_id.slice(0, 12)}…
                                    </td>
                                    <td className="py-3 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${STATUS_STYLES[r.status] ?? "bg-[#f5f5f7] text-[#86868b]"}`}>
                                            {r.status}
                                        </span>
                                    </td>
                                    <td className="py-3 text-[10px] text-[#86868b]">
                                        {new Date(r.requested_at).toLocaleDateString()}
                                    </td>
                                    <td className="py-3">
                                        {r.file_url ? (
                                            <a
                                                href={r.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-[10px] font-black text-[#0c64ef] hover:underline"
                                            >
                                                Download ↗
                                            </a>
                                        ) : (
                                            <span className="text-[10px] text-[#86868b]">—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </Card>
        </div>
    );
}
