"use client";

import React, { useState, useTransition } from "react";
import { ShieldAlert, Plus, Trash2, ChevronDown, ChevronUp, Check } from "lucide-react";
import { toast } from "sonner";
import { ALL_PERMISSIONS, type CustomRole } from "@/app/actions/custom-roles-shared";
import { createCustomRole, updateCustomRole, deleteCustomRole } from "@/app/actions/custom-roles";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

const PERMISSION_GROUPS: { label: string; keys: string[] }[] = [
    { label: "Tasks", keys: ["tasks.create", "tasks.edit", "tasks.delete", "tasks.assign"] },
    { label: "Workspaces", keys: ["workspaces.create", "workspaces.edit", "workspaces.delete"] },
    { label: "Members", keys: ["members.invite", "members.remove"] },
    { label: "Administration", keys: ["reports.view", "audit.view", "integrations.manage", "billing.view"] },
];

interface Props {
    orgId: string;
    roles: CustomRole[];
}

export function CustomRolesManager({ orgId, roles: initialRoles }: Props) {
    const [roles, setRoles] = useState(initialRoles);
    const [showNew, setShowNew] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    return (
        <UpgradeGate feature="custom_roles">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                            <ShieldAlert size={18} className="text-slate-600" />
                        </div>
                        <div>
                            <div className="text-sm font-black text-[#1d1d1f]">Custom Roles</div>
                            <div className="text-xs text-slate-400">Fine-grained permissions beyond the built-in roles</div>
                        </div>
                    </div>
                    <button onClick={() => setShowNew(s => !s)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0051e6] text-white text-[11px] font-black hover:bg-[#005bb7] transition-colors">
                        <Plus size={12} /> New role
                    </button>
                </div>

                {showNew && (
                    <RoleForm
                        orgId={orgId}
                        onSave={role => { setRoles(r => [role, ...r]); setShowNew(false); }}
                        onCancel={() => setShowNew(false)}
                    />
                )}

                <div className="divide-y divide-slate-50">
                    {roles.length === 0 && !showNew && (
                        <div className="py-8 text-center text-sm text-slate-400">No custom roles yet.</div>
                    )}
                    {roles.map(role => (
                        <div key={role.id}>
                            <div className="flex items-center gap-3 px-6 py-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                                onClick={() => setExpandedId(id => id === role.id ? null : role.id)}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="text-sm font-black text-[#1d1d1f]">{role.name}</div>
                                        {role.is_system && (
                                            <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500 font-black uppercase">System</span>
                                        )}
                                    </div>
                                    {role.description && <div className="text-xs text-slate-400 mt-0.5">{role.description}</div>}
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                        {Object.values(role.permissions).filter(Boolean).length} / {ALL_PERMISSIONS.length} permissions
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!role.is_system && (
                                        <button onClick={e => {
                                            e.stopPropagation();
                                            startTransition(async () => {
                                                const r = await deleteCustomRole(role.id, orgId);
                                                if (r.error) { toast.error(r.error); return; }
                                                setRoles(rs => rs.filter(x => x.id !== role.id));
                                                toast.success("Role deleted");
                                            });
                                        }} disabled={pending}
                                            className="p-1.5 rounded-lg text-slate-300 hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors">
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                    {expandedId === role.id ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                </div>
                            </div>

                            {expandedId === role.id && (
                                <RoleForm
                                    orgId={orgId}
                                    existing={role}
                                    onSave={updated => {
                                        setRoles(rs => rs.map(r => r.id === updated.id ? updated : r));
                                        setExpandedId(null);
                                    }}
                                    onCancel={() => setExpandedId(null)}
                                    readOnly={role.is_system}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </UpgradeGate>
    );
}

function RoleForm({ orgId, existing, onSave, onCancel, readOnly = false }: {
    orgId: string;
    existing?: CustomRole;
    onSave: (role: CustomRole) => void;
    onCancel: () => void;
    readOnly?: boolean;
}) {
    const [name, setName] = useState(existing?.name ?? "");
    const [description, setDescription] = useState(existing?.description ?? "");
    const [selected, setSelected] = useState<string[]>(
        existing
            ? Object.entries(existing.permissions).filter(([, v]) => v).map(([k]) => k)
            : []
    );
    const [pending, startTransition] = useTransition();

    function toggle(perm: string) {
        setSelected(s => s.includes(perm) ? s.filter(x => x !== perm) : [...s, perm]);
    }

    function toggleGroup(keys: string[], allOn: boolean) {
        setSelected(s => allOn ? s.filter(x => !keys.includes(x)) : [...new Set([...s, ...keys])]);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        startTransition(async () => {
            if (existing) {
                const r = await updateCustomRole(existing.id, orgId, name, description, selected);
                if (r.error) { toast.error(r.error); return; }
                const updated: CustomRole = { ...existing, name, description, permissions: Object.fromEntries(ALL_PERMISSIONS.map(p => [p, selected.includes(p)])) };
                onSave(updated);
                toast.success("Role updated");
            } else {
                const r = await createCustomRole(orgId, name, description, selected);
                if (r.error) { toast.error(r.error); return; }
                onSave(r.data as CustomRole);
                toast.success("Role created");
            }
        });
    }

    return (
        <form onSubmit={handleSubmit} className="px-6 py-4 bg-slate-50/50 border-b border-slate-100 space-y-4">
            {!readOnly && (
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Role name</label>
                        <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Read-only Auditor"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none bg-white" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Description</label>
                        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none bg-white" />
                    </div>
                </div>
            )}

            <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Permissions</div>
                <div className="space-y-3">
                    {PERMISSION_GROUPS.map(group => {
                        const allOn = group.keys.every(k => selected.includes(k));
                        return (
                            <div key={group.label}>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <button type="button" onClick={() => !readOnly && toggleGroup(group.keys, allOn)}
                                        className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded transition-colors ${allOn ? "bg-[#0051e6]/10 text-[#0051e6]" : "text-slate-400 hover:text-slate-600"}`}>
                                        {group.label}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {group.keys.map(perm => (
                                        <label key={perm} className={`flex items-center gap-2 ${readOnly ? "cursor-default" : "cursor-pointer"}`}>
                                            <div onClick={() => !readOnly && toggle(perm)}
                                                className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${selected.includes(perm) ? "bg-[#0051e6] border-[#0051e6]" : "border-slate-300"} ${readOnly ? "" : "cursor-pointer"}`}>
                                                {selected.includes(perm) && <Check size={10} className="text-white" />}
                                            </div>
                                            <span className="text-xs font-bold text-slate-600">{perm}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {!readOnly && (
                <div className="flex gap-2 pt-1">
                    <button type="submit" disabled={pending}
                        className="flex-1 px-3 py-2 rounded-xl bg-[#0051e6] text-white text-sm font-black disabled:opacity-50">
                        {pending ? "Saving…" : existing ? "Update role" : "Create role"}
                    </button>
                    <button type="button" onClick={onCancel}
                        className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500">
                        Cancel
                    </button>
                </div>
            )}
            {readOnly && (
                <button type="button" onClick={onCancel}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500">
                    Close
                </button>
            )}
        </form>
    );
}
