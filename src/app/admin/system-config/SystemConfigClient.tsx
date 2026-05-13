"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSystemConfig, type ConfigEntry } from "../actions-system-config";
import { Card, SectionLabel, Button, Input, Field } from "../_components/ui";

function TypeBadge({ type }: { type: string }) {
    const map: Record<string, string> = {
        string:  "bg-slate-100 text-slate-600",
        number:  "bg-blue-50 text-blue-600",
        boolean: "bg-purple-50 text-purple-600",
        json:    "bg-amber-50 text-amber-600",
    };
    return (
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${map[type] ?? map.string}`}>
            {type}
        </span>
    );
}

function ConfigRow({ entry }: { entry: ConfigEntry }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(entry.value);
    const [pending, startTransition] = useTransition();

    const save = () => {
        startTransition(async () => {
            try {
                await updateSystemConfig(entry.key, value);
                toast.success(`"${entry.key}" updated`);
                setEditing(false);
            } catch (e: any) {
                toast.error(e.message || "Failed to save");
            }
        });
    };

    const displayValue = () => {
        if (entry.type === "boolean") {
            return (
                <select
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-[#e5e5ea] bg-white text-sm focus:outline-none focus:border-[#0051e6] focus:ring-2 focus:ring-[#0051e6]/10"
                >
                    <option value="true">true</option>
                    <option value="false">false</option>
                </select>
            );
        }
        if (entry.type === "json" || entry.key === "maintenance_message") {
            return (
                <textarea
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-md border border-[#e5e5ea] bg-white text-sm font-mono focus:outline-none focus:border-[#0051e6] focus:ring-2 focus:ring-[#0051e6]/10 resize-y"
                />
            );
        }
        return <Input value={value} onChange={e => setValue(e.target.value)} type={entry.type === "number" ? "number" : "text"} />;
    };

    return (
        <div className="grid grid-cols-[1fr_auto] gap-4 py-4 border-b border-[#f0f0f2] last:border-0">
            <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                    <code className="text-sm font-mono font-semibold text-[#1d1d1f]">{entry.key}</code>
                    <TypeBadge type={entry.type} />
                </div>
                {entry.description && (
                    <p className="text-xs text-[#86868b] mb-2">{entry.description}</p>
                )}
                {editing ? (
                    <div className="space-y-2 mt-2">
                        {displayValue()}
                        <div className="flex gap-2">
                            <Button onClick={save} disabled={pending}>
                                {pending ? "Saving…" : "Save"}
                            </Button>
                            <Button variant="secondary" onClick={() => { setEditing(false); setValue(entry.value); }}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="mt-1 px-2.5 py-1.5 rounded bg-[#f5f5f7] inline-block">
                        <span className="text-sm font-mono text-[#1d1d1f]">{entry.value}</span>
                    </div>
                )}
            </div>
            {!editing && (
                <button
                    onClick={() => setEditing(true)}
                    className="self-start mt-1 px-3 py-1.5 rounded-md text-xs font-medium text-[#52525b] border border-[#e5e5ea] hover:bg-[#f5f5f7] transition-colors"
                >
                    Edit
                </button>
            )}
        </div>
    );
}

export function SystemConfigClient({ config }: { config: ConfigEntry[] }) {
    const groups: Record<string, ConfigEntry[]> = {
        "Billing & Trials": config.filter(c => ["trial_days", "grace_period_days"].includes(c.key)),
        "Feature Toggles":  config.filter(c => ["ai_features_enabled", "maintenance_mode"].includes(c.key)),
        "Maintenance":       config.filter(c => ["maintenance_message"].includes(c.key)),
        "Limits & Quotas":  config.filter(c => ["max_export_rows", "max_file_upload_mb", "session_timeout_hours"].includes(c.key)),
        "Contact":           config.filter(c => ["support_email"].includes(c.key)),
    };

    return (
        <div className="space-y-6">
            {Object.entries(groups).map(([groupName, entries]) => (
                entries.length > 0 && (
                    <Card key={groupName}>
                        <SectionLabel>{groupName}</SectionLabel>
                        <div>
                            {entries.map(entry => <ConfigRow key={entry.key} entry={entry} />)}
                        </div>
                    </Card>
                )
            ))}
        </div>
    );
}
