import { notFound } from "next/navigation";
import { resolveShareToken } from "@/app/actions/share-links";

interface Props {
    params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: Props) {
    const { token } = await params;
    const result = await resolveShareToken(token);

    if (!result) return notFound();

    const { token: tokenRow, resource } = result;

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center p-6">
            <div className="bg-white rounded-3xl shadow-xl max-w-xl w-full p-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-[#0c64ef]/10 flex items-center justify-center text-[#0c64ef] text-xl">
                        {tokenRow.resource_type === "project" ? "📁" : "✅"}
                    </div>
                    <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Shared {tokenRow.resource_type}
                        </div>
                        <h1 className="text-xl font-black text-[#1d1d1f]">
                            {String(resource.name ?? "Untitled")}
                        </h1>
                    </div>
                </div>

                {/* Resource details */}
                <div className="space-y-3">
                    {resource.description ? (
                        <p className="text-sm text-slate-600 leading-relaxed">
                            {String(resource.description)}
                        </p>
                    ) : null}

                    {resource.notes ? (
                        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                            {String(resource.notes)}
                        </p>
                    ) : null}

                    <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                        {resource.status ? (
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Status</div>
                                <div className="text-sm font-bold text-[#1d1d1f]">{String(resource.status)}</div>
                            </div>
                        ) : null}
                        {resource.priority ? (
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Priority</div>
                                <div className="text-sm font-bold text-[#1d1d1f]">{String(resource.priority)}</div>
                            </div>
                        ) : null}
                        {resource.deadline ? (
                            <div>
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Due</div>
                                <div className="text-sm font-bold text-[#1d1d1f]">
                                    {new Date(String(resource.deadline)).toLocaleDateString("en-US", {
                                        weekday: "short", month: "short", day: "numeric", year: "numeric"
                                    })}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-[10px] text-slate-400">
                        {tokenRow.view_count} views ·{" "}
                        {tokenRow.expires_at
                            ? `Expires ${new Date(tokenRow.expires_at).toLocaleDateString()}`
                            : "No expiry"}
                    </div>
                    <div className="text-[10px] font-black text-slate-400 flex items-center gap-1">
                        Powered by
                        <span className="text-[#0c64ef] font-black">TaskFlow</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
