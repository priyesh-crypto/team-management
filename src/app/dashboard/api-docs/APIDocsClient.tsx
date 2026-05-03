"use client";

import React, { useState } from "react";
import { Code2, ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { toast } from "sonner";

const BASE = "https://app.taskflow.io/api/v1";

interface Endpoint {
    method: "GET" | "POST" | "DELETE";
    path: string;
    summary: string;
    description: string;
    scope?: string;
    params?: { name: string; in: "query" | "body"; required: boolean; type: string; description: string }[];
    example: {
        request?: string;
        response: string;
    };
}

const ENDPOINTS: { group: string; endpoints: Endpoint[] }[] = [
    {
        group: "Tasks",
        endpoints: [
            {
                method: "GET", path: "/tasks",
                summary: "List tasks",
                description: "Returns tasks for the organization associated with the API key. Supports filtering and pagination.",
                params: [
                    { name: "status", in: "query", required: false, type: "string", description: "Filter by status (e.g. 'In Progress')" },
                    { name: "priority", in: "query", required: false, type: "string", description: "Filter by priority (Urgent, High, Medium, Low)" },
                    { name: "limit", in: "query", required: false, type: "integer", description: "Max results (default 50, max 100)" },
                    { name: "offset", in: "query", required: false, type: "integer", description: "Pagination offset (default 0)" },
                ],
                example: {
                    response: JSON.stringify({ data: [{ id: "uuid", name: "Ship homepage redesign", status: "In Progress", priority: "High", deadline: "2026-05-15", employee_id: "uuid" }], meta: { limit: 50, offset: 0, total: 1 } }, null, 2),
                },
            },
            {
                method: "POST", path: "/tasks",
                summary: "Create a task",
                description: "Creates a new task in the organization. Requires 'write' scope.",
                scope: "write",
                params: [
                    { name: "name", in: "body", required: true, type: "string", description: "Task name" },
                    { name: "workspace_id", in: "body", required: true, type: "string", description: "Workspace UUID" },
                    { name: "employee_id", in: "body", required: true, type: "string", description: "Assignee user UUID" },
                    { name: "priority", in: "body", required: false, type: "string", description: "Urgent | High | Medium | Low (default Medium)" },
                    { name: "status", in: "body", required: false, type: "string", description: "Default: 'To Do'" },
                    { name: "deadline", in: "body", required: false, type: "date", description: "ISO date (default: 7 days from now)" },
                    { name: "notes", in: "body", required: false, type: "string", description: "Task description" },
                ],
                example: {
                    request: JSON.stringify({ name: "Fix login bug", workspace_id: "uuid", employee_id: "uuid", priority: "High" }, null, 2),
                    response: JSON.stringify({ data: { id: "uuid", name: "Fix login bug", status: "To Do", priority: "High" } }, null, 2),
                },
            },
        ],
    },
    {
        group: "Comments",
        endpoints: [
            {
                method: "GET", path: "/comments",
                summary: "List task comments",
                description: "Returns all comments for a specific task.",
                params: [{ name: "task_id", in: "query", required: true, type: "string", description: "Task UUID" }],
                example: {
                    response: JSON.stringify({ data: [{ id: "uuid", task_id: "uuid", user_id: "uuid", content: "Looks good!", created_at: "2026-04-30T12:00:00Z" }] }, null, 2),
                },
            },
            {
                method: "POST", path: "/comments",
                summary: "Add a comment",
                description: "Adds a comment to a task. Requires 'write' scope.",
                scope: "write",
                params: [
                    { name: "task_id", in: "body", required: true, type: "string", description: "Task UUID" },
                    { name: "content", in: "body", required: true, type: "string", description: "Comment text" },
                ],
                example: {
                    request: JSON.stringify({ task_id: "uuid", content: "Deployed to staging." }, null, 2),
                    response: JSON.stringify({ data: { id: "uuid", content: "Deployed to staging.", created_at: "2026-04-30T12:01:00Z" } }, null, 2),
                },
            },
        ],
    },
    {
        group: "Members",
        endpoints: [
            {
                method: "GET", path: "/members",
                summary: "List organization members",
                description: "Returns all members of the organization.",
                example: {
                    response: JSON.stringify({ data: [{ user_id: "uuid", role: "member", created_at: "2026-01-01T00:00:00Z" }], meta: { total: 1 } }, null, 2),
                },
            },
        ],
    },
    {
        group: "Workspaces",
        endpoints: [
            {
                method: "GET", path: "/workspaces",
                summary: "List workspaces",
                description: "Returns all workspaces in the organization.",
                example: {
                    response: JSON.stringify({ data: [{ id: "uuid", name: "Engineering", created_at: "2026-01-01T00:00:00Z" }], meta: { total: 1 } }, null, 2),
                },
            },
        ],
    },
    {
        group: "Export",
        endpoints: [
            {
                method: "GET", path: "/export",
                summary: "Export data",
                description: "Downloads organization data as CSV or JSON. Requires 'data_export' feature.",
                params: [
                    { name: "type", in: "query", required: false, type: "string", description: "tasks | members | time_entries | full (default: tasks)" },
                    { name: "format", in: "query", required: false, type: "string", description: "csv | json (default: csv)" },
                ],
                example: {
                    response: "Binary file download (Content-Disposition: attachment)",
                },
            },
        ],
    },
];

const METHOD_COLORS: Record<string, string> = {
    GET: "bg-[#34c759]/10 text-[#34c759]",
    POST: "bg-[#0051e6]/10 text-[#0051e6]",
    DELETE: "bg-[#ff3b30]/10 text-[#ff3b30]",
    PUT: "bg-[#ff9500]/10 text-[#ff9500]",
};

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors text-slate-400">
            {copied ? <Check size={12} className="text-[#34c759]" /> : <Copy size={12} />}
        </button>
    );
}

interface Props { orgId: string }

export function APIDocsClient({ orgId }: Props) {
    const [openGroup, setOpenGroup] = useState<string>("Tasks");
    const [openEndpoint, setOpenEndpoint] = useState<string>("/tasks-GET");

    return (
        <div className="p-8 max-w-5xl space-y-8">
            <div>
                <div className="flex items-center gap-3 mb-1">
                    <Code2 size={20} className="text-[#0051e6]" />
                    <h1 className="text-2xl font-black text-[#1d1d1f]">REST API Reference</h1>
                </div>
                <p className="text-sm text-slate-400">Authenticate with a Bearer token from <a href="/dashboard/settings/integrations" className="text-[#0051e6] hover:underline">Settings → Integrations</a>.</p>
            </div>

            {/* Auth box */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Authentication</div>
                <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 px-4 py-3">
                    <code className="flex-1 text-sm font-mono text-slate-700">Authorization: Bearer tf_your_api_key</code>
                    <CopyButton text="Authorization: Bearer tf_your_api_key" />
                </div>
                <div className="mt-3 flex items-center gap-2">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Base URL</div>
                    <code className="text-xs font-mono text-slate-600">{BASE}</code>
                </div>
            </div>

            {/* Endpoints */}
            <div className="space-y-4">
                {ENDPOINTS.map(group => (
                    <div key={group.group} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                        <button
                            onClick={() => setOpenGroup(g => g === group.group ? "" : group.group)}
                            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors">
                            <span className="text-sm font-black text-[#1d1d1f]">{group.group}</span>
                            {openGroup === group.group
                                ? <ChevronDown size={14} className="text-slate-400" />
                                : <ChevronRight size={14} className="text-slate-400" />
                            }
                        </button>

                        {openGroup === group.group && (
                            <div className="border-t border-slate-100 divide-y divide-slate-50">
                                {group.endpoints.map(ep => {
                                    const key = `${ep.path}-${ep.method}`;
                                    const isOpen = openEndpoint === key;
                                    const curlExample = `curl -X ${ep.method} "${BASE}${ep.path}${ep.method === "GET" && ep.params?.some(p => p.in === "query") ? "?..." : ""}" \\
  -H "Authorization: Bearer tf_your_api_key"${ep.example.request ? ` \\
  -H "Content-Type: application/json" \\
  -d '${ep.example.request}'` : ""}`;

                                    return (
                                        <div key={key}>
                                            <button onClick={() => setOpenEndpoint(k => k === key ? "" : key)}
                                                className="w-full flex items-center gap-3 px-6 py-3.5 hover:bg-slate-50/50 transition-colors text-left">
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide min-w-[44px] text-center ${METHOD_COLORS[ep.method]}`}>
                                                    {ep.method}
                                                </span>
                                                <code className="text-sm font-mono text-slate-700">{ep.path}</code>
                                                <span className="text-xs text-slate-400 flex-1">{ep.summary}</span>
                                                {ep.scope && (
                                                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-[#ff9500]/10 text-[#ff9500] rounded">scope:{ep.scope}</span>
                                                )}
                                                {isOpen ? <ChevronDown size={12} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={12} className="text-slate-400 flex-shrink-0" />}
                                            </button>

                                            {isOpen && (
                                                <div className="px-6 pb-5 space-y-4 bg-slate-50/30">
                                                    <p className="text-sm text-slate-600">{ep.description}</p>

                                                    {ep.params && ep.params.length > 0 && (
                                                        <div>
                                                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Parameters</div>
                                                            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                                                                {ep.params.map((p, i) => (
                                                                    <div key={p.name} className={`flex items-start gap-3 px-4 py-3 text-sm ${i < ep.params!.length - 1 ? "border-b border-slate-50" : ""}`}>
                                                                        <code className="font-mono font-bold text-[#0051e6] min-w-[120px]">{p.name}</code>
                                                                        <div className="flex-1 min-w-0">
                                                                            <span className="text-[10px] font-bold text-slate-400">{p.in} · {p.type}</span>
                                                                            {p.required && <span className="ml-2 text-[9px] font-black text-[#ff3b30]">required</span>}
                                                                            <div className="text-xs text-slate-500 mt-0.5">{p.description}</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div>
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Example</div>
                                                        <div className="space-y-2">
                                                            <div className="rounded-xl bg-[#1d1d1f] p-4 relative group">
                                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <CopyButton text={curlExample} />
                                                                </div>
                                                                <pre className="text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap">{curlExample}</pre>
                                                            </div>
                                                            <div className="rounded-xl bg-slate-800 p-4 relative group">
                                                                <div className="text-[9px] font-black text-slate-500 uppercase mb-2">Response</div>
                                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <CopyButton text={ep.example.response} />
                                                                </div>
                                                                <pre className="text-xs font-mono text-[#34c759] overflow-x-auto whitespace-pre-wrap">{ep.example.response}</pre>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
