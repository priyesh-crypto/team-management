"use client";

import React, { useState, useTransition } from "react";
import { Bookmark, Trash2, Plus, Share2 } from "lucide-react";
import { toast } from "sonner";
import { SavedView, saveView, deleteSavedView } from "@/app/actions/saved-views";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface Props {
    views: SavedView[];
    currentViewState: Record<string, unknown>;
    onLoadView: (viewState: Record<string, unknown>) => void;
}

export function SavedViewsDropdown({ views, currentViewState, onLoadView }: Props) {
    const [open, setOpen] = useState(false);
    const [showSave, setShowSave] = useState(false);
    const [name, setName] = useState("");
    const [isShared, setIsShared] = useState(false);
    const [pending, startTransition] = useTransition();

    function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) return;
        startTransition(async () => {
            try {
                await saveView({ name: name.trim(), view_state: currentViewState, is_shared: isShared });
                setName("");
                setShowSave(false);
                toast.success("View saved");
            } catch {
                toast.error("Failed to save view");
            }
        });
    }

    function handleDelete(e: React.MouseEvent, id: string) {
        e.stopPropagation();
        startTransition(async () => {
            try {
                await deleteSavedView(id);
                toast.success("View deleted");
            } catch {
                toast.error("Failed to delete view");
            }
        });
    }

    return (
        <UpgradeGate feature="saved_views">
            <div className="relative">
                <button
                    onClick={() => setOpen(o => !o)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-black text-slate-600 hover:border-[#0051e6]/30 hover:text-[#0051e6] transition-colors shadow-sm"
                >
                    <Bookmark size={12} />
                    Views {views.length > 0 && <span className="ml-0.5 text-[#0051e6]">({views.length})</span>}
                </button>

                {open && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 z-30 overflow-hidden">
                        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Saved views</span>
                            <button
                                onClick={() => setShowSave(s => !s)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0051e6] text-white text-[10px] font-black"
                            >
                                <Plus size={10} /> Save current
                            </button>
                        </div>

                        {showSave && (
                            <form onSubmit={handleSave} className="p-3 border-b border-slate-100 space-y-2">
                                <input
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="View name (e.g. My urgent tasks)"
                                    autoFocus
                                    className="w-full px-3 py-2 text-[12px] font-bold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#0051e6]/20"
                                />
                                <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={isShared}
                                        onChange={e => setIsShared(e.target.checked)}
                                        className="rounded"
                                    />
                                    <Share2 size={10} />
                                    Share with org
                                </label>
                                <div className="flex gap-2">
                                    <button type="submit" disabled={pending} className="flex-1 px-3 py-1.5 rounded-xl bg-[#0051e6] text-white text-[11px] font-black disabled:opacity-50">
                                        {pending ? "Saving…" : "Save"}
                                    </button>
                                    <button type="button" onClick={() => setShowSave(false)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] font-bold text-slate-500">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        )}

                        {views.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                                No saved views yet.
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                                {views.map(v => (
                                    <button
                                        key={v.id}
                                        onClick={() => { onLoadView(v.view_state); setOpen(false); }}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 group flex items-center justify-between gap-2"
                                    >
                                        <div>
                                            <div className="text-sm font-black text-[#1d1d1f] group-hover:text-[#0051e6]">{v.name}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">
                                                {v.is_shared ? "Shared · " : "Private · "}
                                                {new Date(v.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <button
                                            onClick={e => handleDelete(e, v.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-300 hover:text-[#ff3b30] transition-all"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </UpgradeGate>
    );
}
