"use client";

import React, { useState, useTransition } from "react";
import { LayoutTemplate, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { TaskTemplate, deleteTaskTemplate } from "@/app/actions/task-templates";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface Props {
    templates: TaskTemplate[];
    onSelect: (templateData: Record<string, unknown>) => void;
    onSaveCurrent: () => void;
}

export function TaskTemplatesPicker({ templates, onSelect, onSaveCurrent }: Props) {
    const [open, setOpen] = useState(false);
    const [, startTransition] = useTransition();

    function handleDelete(e: React.MouseEvent, id: string) {
        e.stopPropagation();
        startTransition(async () => {
            try {
                await deleteTaskTemplate(id);
                toast.success("Template deleted");
            } catch {
                toast.error("Failed to delete template");
            }
        });
    }

    return (
        <UpgradeGate feature="task_templates">
            <div className="relative">
                <button
                    onClick={() => setOpen(o => !o)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-[11px] font-black text-slate-600 hover:border-[#0c64ef]/30 hover:text-[#0c64ef] transition-colors shadow-sm"
                >
                    <LayoutTemplate size={12} />
                    Templates
                </button>

                {open && (
                    <div className="absolute left-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 z-30 overflow-hidden">
                        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Task templates</span>
                            <button
                                onClick={() => { onSaveCurrent(); setOpen(false); }}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0c64ef] text-white text-[10px] font-black"
                            >
                                <Plus size={10} /> Save current
                            </button>
                        </div>

                        {templates.length === 0 ? (
                            <div className="py-8 text-center text-xs text-slate-400">
                                No templates yet. Fill out a task form and click "Save current".
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                                {templates.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => { onSelect(t.template_data); setOpen(false); }}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors group flex items-start justify-between gap-2"
                                    >
                                        <div>
                                            <div className="text-sm font-black text-[#1d1d1f] group-hover:text-[#0c64ef] transition-colors">
                                                {t.name}
                                            </div>
                                            {t.description && (
                                                <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{t.description}</div>
                                            )}
                                        </div>
                                        <button
                                            onClick={e => handleDelete(e, t.id)}
                                            className="flex-shrink-0 p-1 rounded text-slate-300 hover:text-[#ff3b30] opacity-0 group-hover:opacity-100 transition-all"
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
