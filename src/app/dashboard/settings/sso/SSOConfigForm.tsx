"use client";

import React, { useState, useTransition } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { saveSSOConfig, toggleSSO, type SSOConfig } from "@/app/actions/sso";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

interface Props {
    orgId: string;
    config: SSOConfig | null;
}

export function SSOConfigForm({ orgId, config }: Props) {
    const [provider, setProvider] = useState(config?.provider ?? "saml");
    const [fields, setFields] = useState({
        idp_metadata_url: config?.idp_metadata_url ?? "",
        idp_entity_id: config?.idp_entity_id ?? "",
        idp_sso_url: config?.idp_sso_url ?? "",
        idp_certificate: config?.idp_certificate ?? "",
        client_id: config?.client_id ?? "",
        client_secret: config?.client_secret ?? "",
        discovery_url: config?.discovery_url ?? "",
    });
    const [isActive, setIsActive] = useState(config?.is_active ?? false);
    const [pending, startTransition] = useTransition();

    function set(key: keyof typeof fields, value: string) {
        setFields(f => ({ ...f, [key]: value }));
    }

    function handleSave(e: React.FormEvent) {
        e.preventDefault();
        startTransition(async () => {
            const result = await saveSSOConfig(orgId, { provider, ...fields });
            if (result.error) { toast.error(result.error); return; }
            toast.success("SSO configuration saved");
        });
    }

    function handleToggle() {
        startTransition(async () => {
            const next = !isActive;
            const result = await toggleSSO(orgId, next);
            if (result.error) { toast.error(result.error); return; }
            setIsActive(next);
            toast.success(next ? "SSO enabled" : "SSO disabled");
        });
    }

    return (
        <UpgradeGate feature="sso">
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                            <ShieldCheck size={18} className="text-slate-600" />
                        </div>
                        <div>
                            <div className="text-sm font-black text-[#1d1d1f]">Single Sign-On</div>
                            <div className="text-xs text-slate-400">SAML 2.0 or OIDC provider configuration</div>
                        </div>
                    </div>
                    <button
                        onClick={handleToggle}
                        disabled={pending || !config}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 ${isActive ? "bg-[#34c759]" : "bg-slate-200"}`}
                    >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="px-6 py-5 space-y-5">
                    {/* Provider tabs */}
                    <div className="flex gap-2">
                        {["saml", "oidc"].map(p => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setProvider(p)}
                                className={`px-4 py-1.5 rounded-lg text-xs font-black transition-colors ${provider === p ? "bg-[#0c64ef] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                            >
                                {p.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    {provider === "saml" && (
                        <div className="space-y-3">
                            <Field label="IdP Metadata URL" value={fields.idp_metadata_url} onChange={v => set("idp_metadata_url", v)} placeholder="https://idp.example.com/metadata.xml" />
                            <Field label="IdP Entity ID" value={fields.idp_entity_id} onChange={v => set("idp_entity_id", v)} placeholder="https://idp.example.com/entity" />
                            <Field label="IdP SSO URL" value={fields.idp_sso_url} onChange={v => set("idp_sso_url", v)} placeholder="https://idp.example.com/sso" />
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">IdP Certificate (PEM)</label>
                                <textarea
                                    value={fields.idp_certificate}
                                    onChange={e => set("idp_certificate", e.target.value)}
                                    rows={4}
                                    placeholder="-----BEGIN CERTIFICATE-----..."
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none resize-none"
                                />
                            </div>
                        </div>
                    )}

                    {provider === "oidc" && (
                        <div className="space-y-3">
                            <Field label="Discovery URL" value={fields.discovery_url} onChange={v => set("discovery_url", v)} placeholder="https://idp.example.com/.well-known/openid-configuration" />
                            <Field label="Client ID" value={fields.client_id} onChange={v => set("client_id", v)} placeholder="your-client-id" />
                            <Field label="Client Secret" value={fields.client_secret} onChange={v => set("client_secret", v)} placeholder="your-client-secret" type="password" />
                        </div>
                    )}

                    <div className="pt-2 border-t border-slate-100">
                        <div className="bg-slate-50 rounded-xl p-4 mb-4">
                            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">ACS / Callback URL</div>
                            <code className="text-xs font-mono text-slate-700">
                                {typeof window !== "undefined" ? window.location.origin : "https://app.taskflow.io"}/api/auth/sso/callback
                            </code>
                        </div>
                        <button type="submit" disabled={pending}
                            className="w-full px-4 py-2.5 rounded-xl bg-[#0c64ef] text-white text-sm font-black hover:bg-[#005bb7] transition-colors disabled:opacity-50">
                            {pending ? "Saving…" : "Save configuration"}
                        </button>
                    </div>
                </form>
            </div>
        </UpgradeGate>
    );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
    return (
        <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{label}</label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none"
            />
        </div>
    );
}
