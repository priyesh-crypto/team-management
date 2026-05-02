import { Check, X } from "lucide-react";
import Link from "next/link";
import { getAllFeatureOverrides } from "../actions-tier1";
import { PageHeader, Card } from "../_components/ui";

export default async function FeatureFlagsPage() {
    const overrides = await getAllFeatureOverrides();

    const byOrg: Record<string, typeof overrides> = {};
    for (const o of overrides) {
        if (!byOrg[o.org_id]) byOrg[o.org_id] = [];
        byOrg[o.org_id].push(o);
    }

    return (
        <div className="p-8 max-w-5xl space-y-5">
            <PageHeader
                title="Feature flag overrides"
                subtitle="Per-org features enabled or disabled on top of their plan. Manage overrides from each org's detail page."
            />

            {overrides.length === 0 ? (
                <Card>
                    <p className="text-sm text-[#86868b] text-center py-6">
                        No overrides active. All orgs use their plan defaults.
                    </p>
                </Card>
            ) : (
                <div className="space-y-3">
                    {Object.entries(byOrg).map(([orgId, orgOverrides]) => {
                        const orgName = orgOverrides[0].organizations?.name ?? orgId.slice(0, 8);
                        const on = orgOverrides.filter(o => o.enabled);
                        const off = orgOverrides.filter(o => !o.enabled);
                        return (
                            <Card key={orgId} padding="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <Link
                                        href={`/admin/orgs/${orgId}`}
                                        className="text-sm font-medium text-[#1d1d1f] hover:text-[#0c64ef] transition-colors"
                                    >
                                        {orgName}
                                    </Link>
                                    <Link
                                        href={`/admin/orgs/${orgId}`}
                                        className="text-xs font-medium text-[#0c64ef] hover:underline"
                                    >
                                        Manage →
                                    </Link>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {on.map(o => (
                                        <span
                                            key={o.feature_key}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-700"
                                        >
                                            <Check size={11} strokeWidth={2.5} />
                                            {o.feature_key}
                                        </span>
                                    ))}
                                    {off.map(o => (
                                        <span
                                            key={o.feature_key}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 border border-red-200 text-xs font-medium text-red-700"
                                        >
                                            <X size={11} strokeWidth={2.5} />
                                            {o.feature_key}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-xs text-[#86868b] mt-2">
                                    Last updated {new Date(orgOverrides[0].updated_at).toLocaleString()}
                                </p>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
