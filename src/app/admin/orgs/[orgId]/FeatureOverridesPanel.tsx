"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setFeatureOverride, clearFeatureOverride } from "../../actions-tier1";
import { Card, SectionLabel } from "../../_components/ui";

const ALL_FEATURES = [
    ["recurring_tasks", "Pro"],
    ["task_templates", "Pro"],
    ["custom_statuses", "Pro"],
    ["saved_views", "Pro"],
    ["time_tracker", "Pro"],
    ["bulk_actions", "Pro"],
    ["public_share_links", "Pro"],
    ["ai_breakdown", "Pro"],
    ["ai_weekly_summary", "Pro"],
    ["smart_due_dates", "Pro"],
    ["notifications", "Pro"],
    ["task_comments", "Pro"],
    ["comment_reactions", "Pro"],
    ["milestones", "Pro"],
    ["sprints", "Pro"],
    ["github_integration", "Pro"],
    ["extended_api", "Pro"],
    ["slack_integration", "Business"],
    ["calendar_sync", "Business"],
    ["gantt_dependencies", "Business"],
    ["custom_fields", "Business"],
    ["forms", "Business"],
    ["automations", "Business"],
    ["client_portal", "Business"],
    ["approvals", "Business"],
    ["reports_dashboards", "Business"],
    ["org_audit_log", "Business"],
    ["webhooks_api", "Business"],
    ["email_to_task", "Business"],
    ["sso", "Business"],
    ["custom_roles", "Business"],
    ["white_labeling", "Business"],
    ["data_export", "Business"],
    ["workload_view", "Business"],
] as [string, string][];

interface Override {
    feature_key: string;
    enabled: boolean;
    updated_at: string;
}

interface Props {
    orgId: string;
    overrides: Override[];
}

export function FeatureOverridesPanel({ orgId, overrides }: Props) {
    const [pending, startTransition] = useTransition();
    const overrideMap = Object.fromEntries(overrides.map(o => [o.feature_key, o.enabled]));

    function handleToggle(feature: string, current: boolean | undefined, forceOn: boolean) {
        const newValue = forceOn;
        startTransition(async () => {
            try {
                if (current === forceOn) {
                    // Clicking same state = clear override
                    await clearFeatureOverride(orgId, feature);
                    toast.success(`Override cleared for ${feature}`);
                } else {
                    await setFeatureOverride(orgId, feature, newValue);
                    toast.success(`${feature} ${newValue ? "enabled" : "disabled"} for this org`);
                }
            } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
            }
        });
    }

    const groups: Record<string, [string, string][]> = { Pro: [], Business: [] };
    for (const [f, tier] of ALL_FEATURES) groups[tier]?.push([f, tier]);

    return (
        <Card>
            <SectionLabel>Feature flag overrides</SectionLabel>
            <p className="text-[10px] text-[#86868b] mb-4">
                Overrides are merged on top of the org&apos;s plan. Green = force-on, Red = force-off, Grey = no override (plan default).
            </p>
            <div className="space-y-4">
                {Object.entries(groups).map(([tier, features]) => (
                    <div key={tier}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-[#86868b] mb-2">{tier}</p>
                        <div className="grid grid-cols-2 gap-1.5">
                            {features.map(([feature]) => {
                                const override = overrideMap[feature];
                                const hasOverride = override !== undefined;
                                return (
                                    <div key={feature}
                                        className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs transition-colors ${
                                            hasOverride
                                                ? override
                                                    ? "bg-emerald-50 border-emerald-200"
                                                    : "bg-red-50 border-red-200"
                                                : "border-[#e5e5ea] bg-[#f5f5f7]/40"
                                        }`}>
                                        <span className={`font-bold truncate ${hasOverride ? (override ? "text-emerald-800" : "text-red-800") : "text-[#86868b]"}`}>
                                            {feature}
                                        </span>
                                        <div className="flex gap-1 ml-2 flex-shrink-0">
                                            <button
                                                disabled={pending}
                                                onClick={() => handleToggle(feature, override, true)}
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-black transition-colors ${
                                                    hasOverride && override
                                                        ? "bg-emerald-600 text-white"
                                                        : "bg-[#e5e5ea] text-[#86868b] hover:bg-emerald-100 hover:text-emerald-700"
                                                }`}
                                            >
                                                ON
                                            </button>
                                            <button
                                                disabled={pending}
                                                onClick={() => handleToggle(feature, override, false)}
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-black transition-colors ${
                                                    hasOverride && !override
                                                        ? "bg-red-500 text-white"
                                                        : "bg-[#e5e5ea] text-[#86868b] hover:bg-red-100 hover:text-red-700"
                                                }`}
                                            >
                                                OFF
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}
