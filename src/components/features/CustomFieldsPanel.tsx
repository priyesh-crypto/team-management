"use client";

import React, { useState, useTransition } from "react";
import { Plus, Trash2, Sliders } from "lucide-react";
import { toast } from "sonner";
import {
    CustomFieldDef, CustomFieldValue,
    createCustomFieldDef, deleteCustomFieldDef, upsertCustomFieldValue,
} from "@/app/actions/custom-fields";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface Props {
    taskId: string;
    fieldDefs: CustomFieldDef[];
    fieldValues: CustomFieldValue[];
    isManager?: boolean;
}

function FieldInput({ def, value, onChange }: {
    def: CustomFieldDef;
    value: CustomFieldValue | undefined;
    onChange: (defId: string, val: Partial<CustomFieldValue>) => void;
}) {
    const current = {
        text: value?.value_text ?? "",
        number: value?.value_number ?? "",
        date: value?.value_date ?? "",
        json: value?.value_json,
    };

    const inputClass = "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0051e6]/20";

    switch (def.field_type) {
        case "text":
        case "url":
            return (
                <input
                    type={def.field_type === "url" ? "url" : "text"}
                    value={current.text}
                    onChange={e => onChange(def.id, { value_text: e.target.value })}
                    className={inputClass}
                    placeholder={def.name}
                />
            );
        case "number":
            return (
                <input
                    type="number"
                    value={String(current.number)}
                    onChange={e => onChange(def.id, { value_number: parseFloat(e.target.value) || 0 })}
                    className={inputClass}
                />
            );
        case "date":
            return (
                <input
                    type="date"
                    value={current.date}
                    onChange={e => onChange(def.id, { value_date: e.target.value })}
                    className={inputClass}
                />
            );
        case "checkbox":
            return (
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={Boolean(current.json)}
                        onChange={e => onChange(def.id, { value_json: e.target.checked })}
                        className="rounded"
                    />
                    <span className="text-sm font-bold text-slate-700">{def.name}</span>
                </label>
            );
        case "select":
            return (
                <select
                    value={current.text}
                    onChange={e => onChange(def.id, { value_text: e.target.value })}
                    className={inputClass}
                >
                    <option value="">— select —</option>
                    {(def.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
            );
        case "multi_select":
            return (
                <div className="flex flex-wrap gap-1.5">
                    {(def.options ?? []).map(opt => {
                        const selected = Array.isArray(current.json) && (current.json as string[]).includes(opt);
                        return (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                    const arr: string[] = Array.isArray(current.json) ? [...(current.json as string[])] : [];
                                    const next = selected ? arr.filter(x => x !== opt) : [...arr, opt];
                                    onChange(def.id, { value_json: next });
                                }}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                                    selected ? "bg-[#0051e6] text-white border-[#0051e6]" : "border-slate-200 text-slate-600 hover:border-[#0051e6]/30"
                                }`}
                            >
                                {opt}
                            </button>
                        );
                    })}
                </div>
            );
        default:
            return null;
    }
}

export function CustomFieldsPanel({ taskId, fieldDefs, fieldValues, isManager }: Props) {
    const [pending, startTransition] = useTransition();
    const [showAddField, setShowAddField] = useState(false);
    const [newField, setNewField] = useState({ name: "", field_type: "text" as CustomFieldDef["field_type"], options: "" });
    const [localValues, setLocalValues] = useState<Record<string, Partial<CustomFieldValue>>>({});

    function handleValueChange(defId: string, val: Partial<CustomFieldValue>) {
        setLocalValues(v => ({ ...v, [defId]: { ...v[defId], ...val } }));
        startTransition(async () => {
            const merged = { ...localValues[defId], ...val };
            try {
                await upsertCustomFieldValue({
                    field_def_id: defId,
                    task_id: taskId,
                    value_text: merged.value_text ?? undefined,
                    value_number: merged.value_number ?? undefined,
                    value_date: merged.value_date ?? undefined,
                    value_json: merged.value_json ?? undefined,
                });
            } catch {
                toast.error("Failed to save field value");
            }
        });
    }

    function handleAddField(e: React.FormEvent) {
        e.preventDefault();
        startTransition(async () => {
            try {
                await createCustomFieldDef({
                    name: newField.name,
                    field_type: newField.field_type,
                    options: newField.options ? newField.options.split(",").map(s => s.trim()) : undefined,
                });
                setShowAddField(false);
                setNewField({ name: "", field_type: "text", options: "" });
                toast.success("Field created");
            } catch {
                toast.error("Failed to create field");
            }
        });
    }

    function handleDeleteField(id: string) {
        startTransition(async () => {
            try {
                await deleteCustomFieldDef(id);
                toast.success("Field deleted");
            } catch {
                toast.error("Failed to delete field");
            }
        });
    }

    const getValueFor = (defId: string) => fieldValues.find(v => v.field_def_id === defId);

    return (
        <UpgradeGate feature="custom_fields">
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sliders size={14} className="text-[#0051e6]" />
                        <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Custom fields</span>
                    </div>
                    {isManager && (
                        <button
                            onClick={() => setShowAddField(s => !s)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black text-[#0051e6] hover:bg-[#0051e6]/10 transition-colors"
                        >
                            <Plus size={10} /> Add field
                        </button>
                    )}
                </div>

                {showAddField && (
                    <form onSubmit={handleAddField} className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase">Field name</label>
                            <input value={newField.name} onChange={e => setNewField(f => ({ ...f, name: e.target.value }))}
                                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none" required placeholder="e.g. Client name" />
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase">Type</label>
                            <select value={newField.field_type} onChange={e => setNewField(f => ({ ...f, field_type: e.target.value as CustomFieldDef["field_type"] }))}
                                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none">
                                {["text", "number", "date", "select", "multi_select", "checkbox", "url"].map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        {["select", "multi_select"].includes(newField.field_type) && (
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase">Options (comma-separated)</label>
                                <input value={newField.options} onChange={e => setNewField(f => ({ ...f, options: e.target.value }))}
                                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none" placeholder="Option A, Option B, Option C" />
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button type="submit" disabled={pending} className="flex-1 px-3 py-2 rounded-lg bg-[#0051e6] text-white text-[11px] font-black disabled:opacity-50">
                                {pending ? "Saving…" : "Create"}
                            </button>
                            <button type="button" onClick={() => setShowAddField(false)} className="px-3 py-2 rounded-lg border border-slate-200 text-[11px] font-bold text-slate-500">Cancel</button>
                        </div>
                    </form>
                )}

                {fieldDefs.length === 0 && !showAddField && (
                    <div className="text-xs text-slate-400 py-2">No custom fields defined yet.</div>
                )}

                <div className="space-y-3">
                    {fieldDefs.map(def => (
                        <div key={def.id} className="space-y-1 group">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                    {def.name}
                                    {def.is_required && <span className="text-[#ff3b30] ml-0.5">*</span>}
                                </label>
                                {isManager && (
                                    <button onClick={() => handleDeleteField(def.id)}
                                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-300 hover:text-[#ff3b30] transition-all">
                                        <Trash2 size={10} />
                                    </button>
                                )}
                            </div>
                            <FieldInput
                                def={def}
                                value={getValueFor(def.id)}
                                onChange={handleValueChange}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </UpgradeGate>
    );
}
