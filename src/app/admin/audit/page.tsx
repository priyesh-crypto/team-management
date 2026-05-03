import Link from "next/link";
import {
    Pencil,
    Sparkles,
    Globe,
    Trash2,
    RefreshCw,
    Clock,
    Gift,
    XCircle,
    Users,
    Zap,
    ScrollText,
    type LucideIcon,
} from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { PageHeader, Card, humanizeAction } from "../_components/ui";

const ACTION_ICONS: Record<string, LucideIcon> = {
    update_plan: Pencil,
    create_plan: Sparkles,
    upsert_plan_price: Globe,
    delete_plan_price: Trash2,
    set_org_plan: RefreshCw,
    extend_trial: Clock,
    comp_org: Gift,
    cancel_subscription: XCircle,
    adjust_seats: Users,
    delete_organization: Trash2,
};

export default async function AuditPage() {
    const supabase = await createClient();
    const { data: actions } = await supabase
        .from("platform_admin_actions")
        .select("*, organizations:target_org_id(name)")
        .order("created_at", { ascending: false })
        .limit(200);

    return (
        <div className="p-8 max-w-5xl">
            <PageHeader title="Audit log" subtitle="Last 200 platform admin actions." />

            <Card padding="p-0">
                <div className="divide-y divide-[#f0f0f2]">
                    {(actions ?? []).map((a) => {
                        const orgName = Array.isArray(a.organizations)
                            ? a.organizations[0]?.name
                            : a.organizations?.name;
                        const Icon = ACTION_ICONS[a.action] ?? Zap;
                        return (
                            <div key={a.id} className="flex items-start gap-3 p-4 hover:bg-[#fafafa] transition-colors">
                                <div className="w-8 h-8 rounded-md bg-[#0051e6]/10 text-[#0051e6] flex items-center justify-center shrink-0">
                                    <Icon size={15} strokeWidth={2} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-[#1d1d1f]">
                                                {humanizeAction(a.action)}
                                            </div>
                                            {a.target_org_id && (
                                                <Link
                                                    href={`/admin/orgs/${a.target_org_id}`}
                                                    className="text-xs text-[#0051e6] hover:underline"
                                                >
                                                    {orgName ?? a.target_org_id.slice(0, 8) + "…"}
                                                </Link>
                                            )}
                                        </div>
                                        <div className="text-xs text-[#86868b] whitespace-nowrap">
                                            {new Date(a.created_at).toLocaleString()}
                                        </div>
                                    </div>
                                    {a.payload && Object.keys(a.payload).length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {Object.entries(a.payload as Record<string, unknown>).map(
                                                ([k, v]) => (
                                                    <span
                                                        key={k}
                                                        className="text-xs px-2 py-0.5 rounded bg-[#f5f5f7] text-[#52525b]"
                                                    >
                                                        <span className="font-medium text-[#1d1d1f]">
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
                        <div className="p-12 text-center">
                            <ScrollText size={28} strokeWidth={1.5} className="mx-auto mb-2 text-[#86868b]" />
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
