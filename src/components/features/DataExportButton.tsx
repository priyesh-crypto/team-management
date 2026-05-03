"use client";

import React, { useState } from "react";
import { Download, FileJson, FileText } from "lucide-react";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

const EXPORT_TYPES = [
    { value: "tasks", label: "Tasks" },
    { value: "members", label: "Members" },
    { value: "time_entries", label: "Time entries" },
    { value: "full", label: "Full export" },
] as const;

export function DataExportButton() {
    const [type, setType] = useState<string>("tasks");
    const [format, setFormat] = useState<"csv" | "json">("csv");
    const [loading, setLoading] = useState(false);

    async function handleExport() {
        setLoading(true);
        try {
            const url = `/api/v1/export?type=${type}&format=${format}`;
            const res = await fetch(url);
            if (!res.ok) {
                const j = await res.json() as { error?: string };
                throw new Error(j.error ?? "Export failed");
            }
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            const cd = res.headers.get("content-disposition") ?? "";
            const match = cd.match(/filename="(.+?)"/);
            a.download = match?.[1] ?? `export.${format}`;
            a.click();
            URL.revokeObjectURL(a.href);
        } catch (err) {
            alert(err instanceof Error ? err.message : "Export failed");
        } finally {
            setLoading(false);
        }
    }

    return (
        <UpgradeGate feature="data_export">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                        <Download size={18} className="text-slate-600" />
                    </div>
                    <div>
                        <div className="text-sm font-black text-[#1d1d1f]">Data Export</div>
                        <div className="text-xs text-slate-400">Download your organization data as CSV or JSON</div>
                    </div>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Export type</div>
                        <div className="grid grid-cols-2 gap-2">
                            {EXPORT_TYPES.map(t => (
                                <button key={t.value} type="button" onClick={() => setType(t.value)}
                                    className={`px-3 py-2 rounded-xl border text-sm font-black transition-colors ${type === t.value ? "border-[#0051e6] bg-[#0051e6]/5 text-[#0051e6]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Format</div>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setFormat("csv")}
                                className={`flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl border text-sm font-black transition-colors ${format === "csv" ? "border-[#0051e6] bg-[#0051e6]/5 text-[#0051e6]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                                <FileText size={14} /> CSV
                            </button>
                            <button type="button" onClick={() => setFormat("json")}
                                className={`flex items-center gap-2 flex-1 px-3 py-2.5 rounded-xl border text-sm font-black transition-colors ${format === "json" ? "border-[#0051e6] bg-[#0051e6]/5 text-[#0051e6]" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                                <FileJson size={14} /> JSON
                            </button>
                        </div>
                    </div>

                    <button onClick={handleExport} disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0051e6] text-white text-sm font-black hover:bg-[#005bb7] transition-colors disabled:opacity-50">
                        <Download size={14} />
                        {loading ? "Preparing download…" : `Export ${EXPORT_TYPES.find(t => t.value === type)?.label ?? type} as ${format.toUpperCase()}`}
                    </button>
                </div>
            </div>
        </UpgradeGate>
    );
}
