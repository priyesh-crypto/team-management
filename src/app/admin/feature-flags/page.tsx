import { getAllFeatureOverrides } from "../actions-tier1";
import Link from "next/link";

export default async function FeatureFlagsPage() {
    const overrides = await getAllFeatureOverrides();

    const byOrg: Record<string, typeof overrides> = {};
    for (const o of overrides) {
        if (!byOrg[o.org_id]) byOrg[o.org_id] = [];
        byOrg[o.org_id].push(o);
    }

    return (
        <div className="p-10 max-w-5xl space-y-6">
            <div>
                <h1 className="text-2xl font-black tracking-tight text-[#1d1d1f]">Feature Flag Overrides</h1>
                <p className="text-sm text-[#86868b] mt-1">
                    Per-org features enabled or disabled on top of their plan. Manage overrides from each org&apos;s detail page.
                </p>
            </div>

            {overrides.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#e5e5ea] p-10 text-center">
                    <p className="text-sm text-[#86868b]">No overrides active. All orgs use their plan defaults.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.entries(byOrg).map(([orgId, orgOverrides]) => {
                        const orgName = orgOverrides[0].organizations?.name ?? orgId.slice(0, 8);
                        const on = orgOverrides.filter(o => o.enabled);
                        const off = orgOverrides.filter(o => !o.enabled);
                        return (
                            <div key={orgId} className="bg-white rounded-2xl border border-[#e5e5ea] p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <Link
                                        href={`/admin/orgs/${orgId}`}
                                        className="text-sm font-black text-[#1d1d1f] hover:text-[#0c64ef] transition"
                                    >
                                        {orgName}
                                    </Link>
                                    <Link
                                        href={`/admin/orgs/${orgId}`}
                                        className="text-[10px] font-black uppercase tracking-wider text-[#86868b] hover:text-[#0c64ef] transition"
                                    >
                                        Manage →
                                    </Link>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {on.map(o => (
                                        <span key={o.feature_key}
                                            className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] font-black text-emerald-700">
                                            ✓ {o.feature_key}
                                        </span>
                                    ))}
                                    {off.map(o => (
                                        <span key={o.feature_key}
                                            className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-[10px] font-black text-red-700">
                                            ✕ {o.feature_key}
                                        </span>
                                    ))}
                                </div>
                                <p className="text-[10px] text-[#86868b] mt-2">
                                    Last updated {new Date(orgOverrides[0].updated_at).toLocaleString()}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
