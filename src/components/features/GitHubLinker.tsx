"use client";

import React, { useState, useTransition } from "react";
import { Github, Plus, Trash2, ExternalLink, GitPullRequest, GitCommit, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { linkGitHubRef, unlinkGitHubRef, fetchGitHubPR, type GitHubLink, type GitHubConnection } from "@/app/actions/github";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

const LINK_ICONS: Record<string, React.ReactNode> = {
    pr: <GitPullRequest size={12} />,
    commit: <GitCommit size={12} />,
    issue: <AlertCircle size={12} />,
};

const STATE_COLORS: Record<string, string> = {
    open: "text-[#34c759] bg-[#34c759]/10",
    closed: "text-slate-400 bg-slate-100",
    merged: "text-[#af52de] bg-[#af52de]/10",
};

interface Props {
    taskId: string;
    orgId: string;
    connection: GitHubConnection | null;
    initialLinks: GitHubLink[];
}

export function GitHubLinker({ taskId, orgId, connection, initialLinks }: Props) {
    const [links, setLinks] = useState(initialLinks);
    const [showForm, setShowForm] = useState(false);
    const [linkType, setLinkType] = useState<"pr" | "commit" | "issue">("pr");
    const [repo, setRepo] = useState(connection?.repos?.[0]?.full_name ?? "");
    const [refInput, setRefInput] = useState("");
    const [pending, startTransition] = useTransition();

    function handleLink(e: React.FormEvent) {
        e.preventDefault();
        startTransition(async () => {
            const prNumber = linkType !== "commit" ? parseInt(refInput, 10) : undefined;
            const refSha = linkType === "commit" ? refInput : undefined;

            let title: string | undefined;
            let state: string | undefined;
            let url: string | undefined;

            if (linkType === "pr" && prNumber) {
                const fetched = await fetchGitHubPR(orgId, repo, prNumber);
                if (fetched.data) {
                    title = fetched.data.title;
                    state = fetched.data.state;
                    url = fetched.data.url;
                }
            }

            const result = await linkGitHubRef({
                taskId, orgId, repo, linkType,
                refNumber: prNumber,
                refSha,
                title,
                state,
                url,
            });

            if (result.error) { toast.error(result.error); return; }
            setLinks(ls => [result.data as GitHubLink, ...ls]);
            setShowForm(false);
            setRefInput("");
            toast.success("Linked");
        });
    }

    function handleUnlink(linkId: string) {
        startTransition(async () => {
            const result = await unlinkGitHubRef(linkId);
            if (result.error) { toast.error(result.error); return; }
            setLinks(ls => ls.filter(l => l.id !== linkId));
        });
    }

    return (
        <UpgradeGate feature="github_integration">
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                        <Github size={12} /> GitHub
                    </div>
                    {connection?.is_active && (
                        <button onClick={() => setShowForm(s => !s)}
                            className="flex items-center gap-1 text-[10px] font-black text-[#0c64ef] hover:underline">
                            <Plus size={10} /> Link
                        </button>
                    )}
                </div>

                {!connection?.is_active && (
                    <div className="text-xs text-slate-400 py-2">GitHub not connected. Configure in <a href="/dashboard/settings/integrations" className="text-[#0c64ef] hover:underline">Integrations</a>.</div>
                )}

                {showForm && (
                    <form onSubmit={handleLink} className="space-y-2 p-3 bg-slate-50 rounded-xl">
                        <div className="flex gap-1">
                            {(["pr", "issue", "commit"] as const).map(t => (
                                <button key={t} type="button" onClick={() => setLinkType(t)}
                                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black transition-colors ${linkType === t ? "bg-[#0c64ef] text-white" : "bg-white text-slate-500 hover:bg-slate-100"}`}>
                                    {t.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        {(connection?.repos?.length ?? 0) > 1 && (
                            <select value={repo} onChange={e => setRepo(e.target.value)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold focus:outline-none bg-white">
                                {connection?.repos.map(r => (
                                    <option key={r.full_name} value={r.full_name}>{r.full_name}</option>
                                ))}
                            </select>
                        )}
                        <input value={refInput} onChange={e => setRefInput(e.target.value)} required
                            placeholder={linkType === "commit" ? "Commit SHA" : `${linkType === "pr" ? "PR" : "Issue"} number`}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold focus:outline-none bg-white" />
                        <div className="flex gap-1.5">
                            <button type="submit" disabled={pending} className="flex-1 py-1.5 rounded-lg bg-[#0c64ef] text-white text-[10px] font-black disabled:opacity-50">
                                {pending ? "Linking…" : "Link"}
                            </button>
                            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg border border-slate-200 text-[10px] font-bold text-slate-500">
                                Cancel
                            </button>
                        </div>
                    </form>
                )}

                <div className="space-y-1.5">
                    {links.map(link => (
                        <div key={link.id} className="flex items-center gap-2 group py-1">
                            <span className={`flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded ${STATE_COLORS[link.state ?? "open"] ?? STATE_COLORS.open}`}>
                                {LINK_ICONS[link.link_type]}
                                {link.state ?? link.link_type}
                            </span>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-[#1d1d1f] truncate">
                                    {link.title ?? (link.ref_number ? `#${link.ref_number}` : link.ref_sha?.slice(0, 7))}
                                </div>
                                <div className="text-[9px] text-slate-400">{link.repo}</div>
                            </div>
                            {link.url && (
                                <a href={link.url} target="_blank" rel="noopener noreferrer"
                                    className="p-1 rounded text-slate-300 hover:text-[#0c64ef] transition-colors">
                                    <ExternalLink size={11} />
                                </a>
                            )}
                            <button onClick={() => handleUnlink(link.id)} disabled={pending}
                                className="p-1 rounded text-slate-200 hover:text-[#ff3b30] transition-colors opacity-0 group-hover:opacity-100">
                                <Trash2 size={11} />
                            </button>
                        </div>
                    ))}
                    {links.length === 0 && connection?.is_active && !showForm && (
                        <div className="text-xs text-slate-400">No GitHub references linked.</div>
                    )}
                </div>
            </div>
        </UpgradeGate>
    );
}
