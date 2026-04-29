import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { PageHeader, Card, SectionLabel, humanizeAction } from "../_components/ui";

const ACTION_ICONS: Record<string, string> = {
    update_plan: "✏️",
    create_plan: "✨",
    upsert_plan_price: "🌍",
    delete_plan_price: "🗑️",
    set_org_plan: "🔄",
    extend_trial: "⏳",
    comp_org: "🎁",
    cancel_subscription: "❌",
    adjust_seats: "👥",
    delete_organization: "🗑️",
};

export default async function AuditPage() {
    const supabase = await createClient();
    const { data: actions } = await supabase
        .from("platform_admin_actions")
        .select("*, organizations:target_org_id(name)")
        .order("created_at", { ascending: false })
        .limit(200);

    return (
        <div className="p-10 max-w-5xl">
            <PageHeader title="Audit Log" subtitle="Last 200 platform admin actions." />

            <Card padding="p-0">
                <div className="divide-y divide-[#f5f5f7]">
                    {(actions ?? []).map((a) => {
                        const orgName = Array.isArray(a.organizations)
                            ? a.organizations[0]?.name
                            : a.organizations?.name;
                        const icon = ACTION_ICONS[a.action] ?? "⚡";
                        return (
                            <div key={a.id} className="flex items-start gap-4 p-5 hover:bg-[#f5f5f7]/40 transition">
                                <div className="w-10 h-10 rounded-xl bg-[#0c64ef]/10 text-[#0c64ef] flex items-center justify-center text-base flex-shrink-0">
                                    {icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-black text-[#1d1d1f]">
                                                {humanizeAction(a.action)}
                                            </div>
                                            {a.target_org_id && (
                                                <Link
                                                    href={`/admin/orgs/${a.target_org_id}`}
                                                    className="text-xs font-bold text-[#0c64ef] hover:underline"
                                                >
                                                    {orgName ?? a.target_org_id.slice(0, 8) + "…"}
                                                </Link>
                                            )}
                                        </div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#86868b] whitespace-nowrap">
                                            {new Date(a.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                    {a.payload && Object.keys(a.payload).length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {Object.entries(a.payload as Record<string, unknown>).map(
                                                ([k, v]) => (
                                                    <span
                                                        key={k}
                                                        className="text-[10px] px-2 py-1 rounded-md bg-[#f5f5f7] text-[#86868b] font-medium"
                                                    >
                                                        <span className="font-black text-[#1d1d1f]">
                                                            {humanizeAction(k)}:
                                                        </span>{" "}
                                                        {formatPayloadValue(v)}
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {(actions ?? []).length === 0 && (
                        <div className="p-16 text-center">
                            <div className="text-4xl mb-3">📜</div>
                            <p className="text-sm text-[#86868b]">No admin actions logged yet.</p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}

function formatPayloadValue(v: unknown): string {
    if (v === null || v === undefined) return "—";
    if (typeof v === "boolean") return v ? "yes" : "no";
    if (typeof v === "number" || typeof v === "string") return String(v);
    return JSON.stringify(v);
}
