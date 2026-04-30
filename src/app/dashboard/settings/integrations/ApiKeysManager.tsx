"use client";

import React, { useState, useTransition } from "react";
import { Key, Plus, Trash2, Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface ApiKey {
    id: string;
    name: string;
    key_prefix: string;
    scopes: string[];
    last_used_at: string | null;
    expires_at: string | null;
    is_active: boolean;
    created_at: string;
}

interface Props {
    orgId: string;
    keys: ApiKey[];
}

export function ApiKeysManager({ orgId, keys: initialKeys }: Props) {
    const [keys, setKeys] = useState(initialKeys);
    const [showNew, setShowNew] = useState(false);
    const [newName, setNewName] = useState("");
    const [newScopes, setNewScopes] = useState<string[]>(["read"]);
    const [pending, startTransition] = useTransition();
    const [createdKey, setCreatedKey] = useState<string | null>(null);
    const [showCreated, setShowCreated] = useState(false);

    function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        startTransition(async () => {
            try {
                const res = await fetch("/api/v1/api-keys", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: newName, scopes: newScopes, orgId }),
                });
                const json = await res.json() as { key?: string; meta?: ApiKey; error?: string };
                if (!res.ok) throw new Error(json.error ?? "Failed");
                if (json.key) { setCreatedKey(json.key); setShowCreated(true); }
                if (json.meta) setKeys(k => [json.meta!, ...k]);
                setShowNew(false);
                setNewName("");
                toast.success("API key created — copy it now, it won't be shown again");
            } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : "Failed to create key");
            }
        });
    }

    async function handleRevoke(id: string) {
        startTransition(async () => {
            try {
                await fetch(`/api/v1/api-keys?id=${id}`, { method: "DELETE" });
                setKeys(k => k.filter(key => key.id !== id));
                toast.success("API key revoked");
            } catch {
                toast.error("Failed to revoke key");
            }
        });
    }

    return (
        <UpgradeGate feature="webhooks_api">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                            <Key size={18} className="text-slate-600" />
                        </div>
                        <div>
                            <div className="text-sm font-black text-[#1d1d1f]">API Keys</div>
                            <div className="text-xs text-slate-400">Authenticate with the TaskFlow REST API</div>
                        </div>
                    </div>
                    <button onClick={() => setShowNew(s => !s)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0c64ef] text-white text-[11px] font-black hover:bg-[#005bb7] transition-colors">
                        <Plus size={12} /> New key
                    </button>
                </div>

                {createdKey && (
                    <div className="mx-5 mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                        <div className="text-[11px] font-black text-emerald-700 mb-2">Your new API key — copy it now!</div>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 text-xs font-mono bg-white px-3 py-2 rounded-lg border border-emerald-200 truncate">
                                {showCreated ? createdKey : "•".repeat(40)}
                            </code>
                            <button onClick={() => setShowCreated(s => !s)} className="p-2 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-100">
                                {showCreated ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                            <button onClick={() => { navigator.clipboard.writeText(createdKey); toast.success("Copied!"); }}
                                className="p-2 rounded-lg border border-emerald-200 text-emerald-600 hover:bg-emerald-100">
                                <Copy size={14} />
                            </button>
                        </div>
                    </div>
                )}

                {showNew && (
                    <form onSubmit={handleCreate} className="px-6 py-4 border-b border-slate-100 space-y-3">
                        <input value={newName} onChange={e => setNewName(e.target.value)}
                            placeholder="Key name (e.g. Production integration)"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none" required />
                        <div className="flex gap-3">
                            {["read", "write", "admin"].map(scope => (
                                <label key={scope} className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={newScopes.includes(scope)}
                                        onChange={e => setNewScopes(s => e.target.checked ? [...s, scope] : s.filter(x => x !== scope))}
                                        className="rounded" />
                                    <span className="text-sm font-bold text-slate-700 capitalize">{scope}</span>
                                </label>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button type="submit" disabled={pending} className="flex-1 px-3 py-2 rounded-xl bg-[#0c64ef] text-white text-sm font-black disabled:opacity-50">
                                {pending ? "Creating…" : "Create key"}
                            </button>
                            <button type="button" onClick={() => setShowNew(false)} className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500">Cancel</button>
                        </div>
                    </form>
                )}

                <div className="divide-y divide-slate-50">
                    {keys.length === 0 && <div className="py-8 text-center text-sm text-slate-400">No API keys yet.</div>}
                    {keys.map(k => (
                        <div key={k.id} className="flex items-center gap-4 px-6 py-4">
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-black text-[#1d1d1f]">{k.name}</div>
                                <div className="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center gap-2">
                                    <code className="bg-slate-100 px-1.5 rounded font-mono">{k.key_prefix}…</code>
                                    {k.scopes.join(", ")}
                                    {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                                </div>
                            </div>
                            <button onClick={() => handleRevoke(k.id)} disabled={pending}
                                className="p-2 rounded-lg text-slate-300 hover:text-[#ff3b30] hover:bg-[#ff3b30]/10 transition-colors">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </UpgradeGate>
    );
}
