"use client";

import React, { useState } from "react";
import { useFeature } from "@/context/EntitlementContext";

const FEATURE_NAMES: Record<string, string> = {
    recurring_tasks: "Recurring Tasks",
    task_templates: "Task Templates",
    custom_statuses: "Custom Statuses",
    saved_views: "Saved Views",
    time_tracker: "Time Tracker",
    bulk_actions: "Bulk Actions",
    public_share_links: "Public Share Links",
    email_to_task: "Email to Task",
    ai_breakdown: "AI Task Breakdown",
    ai_weekly_summary: "AI Weekly Summary",
    smart_due_dates: "Smart Due Dates",
    slack_integration: "Slack Integration",
    calendar_sync: "Calendar Sync",
    gantt_dependencies: "Gantt & Dependencies",
    custom_fields: "Custom Fields",
    forms: "Forms",
    automations: "Automations",
    client_portal: "Client Portal",
    approvals: "Approvals",
    reports_dashboards: "Reports & Dashboards",
    org_audit_log: "Audit Log",
    webhooks_api: "Webhooks & API",
};

const FEATURE_TIER: Record<string, string> = {
    recurring_tasks: "Pro",
    task_templates: "Pro",
    custom_statuses: "Pro",
    saved_views: "Pro",
    time_tracker: "Pro",
    bulk_actions: "Pro",
    public_share_links: "Pro",
    ai_breakdown: "Pro",
    ai_weekly_summary: "Pro",
    smart_due_dates: "Pro",
    slack_integration: "Business",
    calendar_sync: "Business",
    gantt_dependencies: "Business",
    custom_fields: "Business",
    forms: "Business",
    automations: "Business",
    client_portal: "Business",
    approvals: "Business",
    reports_dashboards: "Business",
    org_audit_log: "Business",
    webhooks_api: "Business",
    email_to_task: "Business",
};

interface PaywallModalProps {
    feature: string;
    onClose: () => void;
}

function PaywallModal({ feature, onClose }: PaywallModalProps) {
    const featureName = FEATURE_NAMES[feature] ?? feature;
    const tier = FEATURE_TIER[feature] ?? "Pro";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full mx-4 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 text-lg leading-none"
                    aria-label="Close"
                >
                    ×
                </button>

                <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0c64ef]/10 text-[#0c64ef] text-2xl mb-5 mx-auto">
                    🔒
                </div>

                <h2 className="text-xl font-black text-[#1d1d1f] text-center mb-2">
                    Unlock {featureName}
                </h2>
                <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">
                    This feature is available on the{" "}
                    <span className="font-black text-[#0c64ef]">{tier} plan</span>.
                    Upgrade to keep your team moving faster.
                </p>

                <a
                    href="/dashboard/settings/billing"
                    className="block w-full text-center px-6 py-3 rounded-xl bg-[#0c64ef] text-white text-sm font-black hover:bg-[#005bb7] transition-colors"
                >
                    Upgrade to {tier}
                </a>
                <button
                    onClick={onClose}
                    className="block w-full text-center mt-3 text-sm font-bold text-slate-400 hover:text-slate-700 transition-colors"
                >
                    Maybe later
                </button>
            </div>
        </div>
    );
}

interface UpgradeGateProps {
    feature: string;
    children: React.ReactNode;
    /** If true, render children but disabled/greyed. Default: hide children and show CTA. */
    mode?: "hide" | "disable";
}

/**
 * Wraps a feature behind a feature flag. If the org doesn't have the feature,
 * renders a locked placeholder. Clicking it opens a paywall modal.
 *
 * Usage:
 *   <UpgradeGate feature="ai_breakdown">
 *     <AIBreakdownButton />
 *   </UpgradeGate>
 */
export function UpgradeGate({ feature, children, mode = "hide" }: UpgradeGateProps) {
    const hasFeature = useFeature(feature);
    const [showModal, setShowModal] = useState(false);

    if (hasFeature) return <>{children}</>;

    if (mode === "disable") {
        return (
            <>
                <div
                    onClick={() => setShowModal(true)}
                    className="cursor-pointer opacity-40 pointer-events-auto select-none"
                    title={`Upgrade to unlock ${FEATURE_NAMES[feature] ?? feature}`}
                >
                    {children}
                </div>
                {showModal && (
                    <PaywallModal feature={feature} onClose={() => setShowModal(false)} />
                )}
            </>
        );
    }

    const featureName = FEATURE_NAMES[feature] ?? feature;
    const tier = FEATURE_TIER[feature] ?? "Pro";

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0c64ef]/20 bg-[#0c64ef]/5 text-[#0c64ef] text-[10px] font-black uppercase tracking-wider hover:bg-[#0c64ef]/10 transition-colors"
            >
                <span>🔒</span>
                {featureName} · {tier}
            </button>
            {showModal && (
                <PaywallModal feature={feature} onClose={() => setShowModal(false)} />
            )}
        </>
    );
}
