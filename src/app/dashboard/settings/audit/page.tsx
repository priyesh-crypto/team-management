import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getEntitlement, hasFeature } from "@/lib/entitlements";

const ACTION_ICONS: Record<string, string> = {
    task_created: "✅", task_updated: "✏️", task_deleted: "🗑️",
    task_status_changed: "🔄", member_invited: "👋", member_joined: "🎉",
    comment_added: "💬", attachment_added: "📎", subtask_created: "📋",
};

export default async function OrgAuditPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/");

    const { data: membership } = await supabase
        .from("organization_members")
        .select("org_id, role")
        .eq("user_id", user.id)
        .maybeSingle();

    if (!membership || !["manager", "admin", "owner"].includes(membership.role)) {
        redirect("/dashboard");
    }

    const entitlement = await getEntitlement(membership.org_id);
    if (!entitlement || !hasFeature(entitlement, "org_audit_log")) {
        return (
            <div className="p-10 max-w-2xl mx-auto text-center">
                <div className="text-4xl mb-4">📋</div>
                <h1 className="text-2xl font-black text-[#1d1d1f] mb-2">Audit Log</h1>
                <p className="text-slate-500">Available on the Business plan. <a href="/dashboard/settings/billing" className="text-[#0c64ef] font-bold hover:underline">Upgrade</a> to unlock.</p>
            </div>
        );
    }

    const { data: logs } = await supabase
        .from("org_audit_logs")
        .select("*")
        .eq("org_id", membership.org_id)
        .order("created_at", { ascending: false })
        .limit(200);

    return (
        <div className="p-8 max-w-4xl space-y-6">
            <div>
                <h1 className="text-2xl font-black text-[#1d1d1f]">Audit Log</h1>
                <p className="text-sm text-slate-400 mt-1">Last 200 organization events.</p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                {(logs ?? []).map(log => (
                    <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-slate-50/50 transition-colors">
                        <div className="w-9 h-9 rounded-xl bg-[#0c64ef]/10 flex items-center justify-center text-base flex-shrink-0">
                            {ACTION_ICONS[log.action] ?? "⚡"}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-black text-[#1d1d1f]">{log.action.replace(/_/g, " ")}</div>
                            <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                                {log.actor_email ?? log.actor_id?.slice(0, 8) ?? "system"}
                                {log.resource_type && ` · ${log.resource_type}`}
                            </div>
                            {log.payload && Object.keys(log.payload).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                    {Object.entries(log.payload as Record<string, unknown>).slice(0, 4).map(([k, v]) => (
                                        <span key={k} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">
                                            {k}: {String(v).slice(0, 30)}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 whitespace-nowrap flex-shrink-0">
                            {new Date(log.created_at).toLocaleString()}
                        </div>
                    </div>
                ))}
                {(logs ?? []).length === 0 && (
                    <div className="py-16 text-center">
                        <div className="text-3xl mb-3">📋</div>
                        <p className="text-sm text-slate-400">No audit events yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
