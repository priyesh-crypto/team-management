"use client";

import React, { useState, useTransition } from "react";
import { Github, Plus, X, Check } from "lucide-react";
import { toast } from "sonner";
import { saveGitHubConnection, disconnectGitHub, type GitHubConnection } from "@/app/actions/github";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface Props {
    orgId: string;
    connection: GitHubConnection | null;
}

export function GitHubSettings({ orgId, connection }: Props) {
    const [showForm, setShowForm] = useState(!connection?.is_active);
    const [githubOrg, setGithubOrg] = useState(connection?.github_org ?? "");
    const [token, setToken] = useState("");
    const [repoInput, setRepoInput] = useState("");
    const [repos, setRepos] = useState<{ owner: string; name: string; full_name: string }[]>(connection?.repos ?? []);
    const [pending, startTransition] = useTransition();

    function addRepo() {
        const full = repoInput.trim();
        if (!full.includes("/")) { toast.error("Format: owner/repo"); return; }
        const [owner, name] = full.split("/");
        if (repos.some(r => r.full_name === full)) return;
        setRepos(rs => [...rs, { owner, name, full_name: full }]);
        setRepoInput("");
    }

    function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (repos.length === 0) { toast.error("Add at least one repository"); return; }
        startTransition(async () => {
            const result = await saveGitHubConnection(orgId, { github_org: githubOrg, access_token: token, repos });
            if (result.error) { toast.error(result.error); return; }
            setShowForm(false);
            toast.success("GitHub connected");
        });
    }

    function handleDisconnect() {
        startTransition(async () => {
            const result = await disconnectGitHub(orgId);
            if (result.error) { toast.error(result.error); return; }
            setShowForm(true);
            toast.success("GitHub disconnected");
        });
    }

    return (
        <UpgradeGate feature="github_integration">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                            <Github size={18} className="text-slate-600" />
                        </div>
                        <div>
                            <div className="text-sm font-black text-[#1d1d1f]">GitHub</div>
                            <div className="text-xs text-slate-400">Link PRs, commits and issues to tasks</div>
                        </div>
                    </div>
                    {connection?.is_active && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 text-[11px] font-black text-[#34c759]">
                                <Check size={11} /> Connected
                            </div>
                            <button onClick={handleDisconnect} disabled={pending}
                                className="text-[10px] font-bold text-slate-400 hover:text-[#ff3b30] transition-colors">
                                Disconnect
                            </button>
                        </div>
                    )}
                </div>

                {connection?.is_active && !showForm ? (
                    <div className="px-6 py-4 space-y-3">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Connected repos</div>
                        <div className="space-y-1.5">
                            {connection.repos.map(r => (
                                <div key={r.full_name} className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                    <Github size={13} className="text-slate-400" />
                                    {r.full_name}
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setShowForm(true)} className="text-[11px] font-black text-[#0c64ef] hover:underline">
                            Edit configuration
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-xs font-bold text-amber-700">
                                Generate a <strong>Personal Access Token</strong> with <code>repo</code> scope at{" "}
                                <code>github.com/settings/tokens</code>.
                            </p>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">GitHub organization / username</label>
                            <input value={githubOrg} onChange={e => setGithubOrg(e.target.value)} required placeholder="acme-corp"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Personal Access Token</label>
                            <input type="password" value={token} onChange={e => setToken(e.target.value)}
                                required={!connection?.is_active}
                                placeholder={connection?.is_active ? "Leave blank to keep existing token" : "ghp_..."}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Repositories</label>
                            <div className="flex gap-2 mb-2">
                                <input value={repoInput} onChange={e => setRepoInput(e.target.value)}
                                    placeholder="owner/repo-name"
                                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none"
                                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addRepo(); } }} />
                                <button type="button" onClick={addRepo}
                                    className="px-3 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-black hover:bg-slate-200 transition-colors">
                                    <Plus size={14} />
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {repos.map(r => (
                                    <span key={r.full_name} className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-700">
                                        {r.full_name}
                                        <button type="button" onClick={() => setRepos(rs => rs.filter(x => x.full_name !== r.full_name))}
                                            className="text-slate-400 hover:text-[#ff3b30] transition-colors">
                                            <X size={10} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <button type="submit" disabled={pending}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-[#1d1d1f] text-white text-sm font-black hover:bg-black transition-colors disabled:opacity-50">
                                {pending ? "Saving…" : "Connect GitHub"}
                            </button>
                            {connection?.is_active && (
                                <button type="button" onClick={() => setShowForm(false)}
                                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-500">
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                )}
            </div>
        </UpgradeGate>
    );
}
