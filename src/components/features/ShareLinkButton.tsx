"use client";

import React, { useState, useTransition } from "react";
import { Link2, Copy, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { ShareToken, createShareLink, revokeShareLink } from "@/app/actions/share-links";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface Props {
    resourceType: "project" | "task";
    resourceId: string;
    existingLinks: ShareToken[];
}

export function ShareLinkButton({ resourceType, resourceId, existingLinks }: Props) {
    const [open, setOpen] = useState(false);
    const [links, setLinks] = useState<ShareToken[]>(existingLinks);
    const [pending, startTransition] = useTransition();

    const baseUrl = typeof window !== "undefined" ? `${window.location.origin}/share/` : "/share/";

    function handleCreate() {
        startTransition(async () => {
            try {
                const newToken = await createShareLink({ resource_type: resourceType, resource_id: resourceId });
                setLinks(l => [newToken, ...l]);
                toast.success("Share link created");
            } catch {
                toast.error("Failed to create share link");
            }
        });
    }

    function handleCopy(token: string) {
        navigator.clipboard.writeText(baseUrl + token);
        toast.success("Link copied to clipboard");
    }

    function handleRevoke(id: string) {
        startTransition(async () => {
            try {
                await revokeShareLink(id);
                setLinks(l => l.filter(t => t.id !== id));
                toast.success("Link revoked");
            } catch {
                toast.error("Failed to revoke link");
            }
        });
    }

    return (
        <UpgradeGate feature="public_share_links">
            <div className="relative">
                <button
                    onClick={() => setOpen(o => !o)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-black text-slate-600 hover:border-[#0c64ef]/30 hover:text-[#0c64ef] transition-colors shadow-sm"
                >
                    <Link2 size={12} />
                    Share
                    {links.length > 0 && (
                        <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-[#0c64ef]/10 text-[#0c64ef] text-[9px] font-black">
                            {links.length}
                        </span>
                    )}
                </button>

                {open && (
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-30 overflow-hidden">
                        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                                Share links
                            </span>
                            <button
                                onClick={handleCreate}
                                disabled={pending}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0c64ef] text-white text-[10px] font-black disabled:opacity-50"
                            >
                                <Plus size={10} /> New link
                            </button>
                        </div>

                        {links.length === 0 ? (
                            <div className="py-8 text-center">
                                <div className="text-2xl mb-2">🔗</div>
                                <p className="text-xs text-slate-400">No share links yet.</p>
                                <p className="text-xs text-slate-400">Anyone with a link can view this {resourceType}.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                                {links.map(t => {
                                    const url = baseUrl + t.token;
                                    return (
                                        <div key={t.id} className="px-4 py-3 flex items-center gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[11px] font-bold text-slate-700 truncate">{url}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5">
                                                    {t.view_count} views
                                                    {t.expires_at && ` · Expires ${new Date(t.expires_at).toLocaleDateString()}`}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleCopy(t.token)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#0c64ef] hover:bg-[#0c64ef]/10 transition-colors"
                                                title="Copy link"
                                            >
                                                <Copy size={13} />
                                            </button>
                                            <button
                                                onClick={() => handleRevoke(t.id)}
                                                disabled={pending}
                                                className="p-1.5 rounded-lg text-slate-300 hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors"
                                                title="Revoke"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </UpgradeGate>
    );
}
