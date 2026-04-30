"use client";

import React, { useState, useTransition } from "react";
import { Palette } from "lucide-react";
import { toast } from "sonner";
import { saveBranding, type OrgBranding } from "@/app/actions/branding";
import { UpgradeGate } from "@/components/ui/UpgradeGate";

const PRESET_COLORS = [
    "#0c64ef", "#34c759", "#ff9500", "#ff3b30",
    "#af52de", "#5ac8fa", "#1d1d1f", "#6e6e73",
];

interface Props {
    orgId: string;
    branding: OrgBranding | null;
}

export function BrandingSettings({ orgId, branding }: Props) {
    const [form, setForm] = useState<OrgBranding>({
        logo_url: branding?.logo_url ?? "",
        favicon_url: branding?.favicon_url ?? "",
        primary_color: branding?.primary_color ?? "#0c64ef",
        accent_color: branding?.accent_color ?? "#34c759",
        org_display_name: branding?.org_display_name ?? "",
        custom_domain: branding?.custom_domain ?? "",
        support_email: branding?.support_email ?? "",
    });
    const [pending, startTransition] = useTransition();

    function set<K extends keyof OrgBranding>(key: K, value: OrgBranding[K]) {
        setForm(f => ({ ...f, [key]: value }));
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        startTransition(async () => {
            const result = await saveBranding(orgId, form);
            if (result.error) { toast.error(result.error); return; }
            toast.success("Branding saved");
        });
    }

    return (
        <UpgradeGate feature="white_labeling">
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                        <Palette size={18} className="text-slate-600" />
                    </div>
                    <div>
                        <div className="text-sm font-black text-[#1d1d1f]">White-labeling & Branding</div>
                        <div className="text-xs text-slate-400">Customize your workspace appearance</div>
                    </div>
                </div>

                <div className="px-6 py-5 space-y-5">
                    {/* Identity */}
                    <Section title="Identity">
                        <Field label="Organization display name" value={form.org_display_name ?? ""} onChange={v => set("org_display_name", v)} placeholder="Acme Corp" />
                        <Field label="Logo URL" value={form.logo_url ?? ""} onChange={v => set("logo_url", v)} placeholder="https://cdn.example.com/logo.png" />
                        <Field label="Favicon URL" value={form.favicon_url ?? ""} onChange={v => set("favicon_url", v)} placeholder="https://cdn.example.com/favicon.ico" />
                    </Section>

                    {/* Colors */}
                    <Section title="Colors">
                        <ColorPicker label="Primary color" value={form.primary_color} onChange={v => set("primary_color", v)} />
                        <ColorPicker label="Accent color" value={form.accent_color} onChange={v => set("accent_color", v)} />
                    </Section>

                    {/* Domain & support */}
                    <Section title="Domain & support">
                        <Field label="Custom domain" value={form.custom_domain ?? ""} onChange={v => set("custom_domain", v)} placeholder="tasks.acme.com" />
                        <Field label="Support email" value={form.support_email ?? ""} onChange={v => set("support_email", v)} placeholder="help@acme.com" type="email" />
                    </Section>

                    {/* Preview */}
                    <div className="rounded-xl border border-slate-100 p-4">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Preview</div>
                        <div className="flex items-center gap-3">
                            {form.logo_url
                                ? <img src={form.logo_url} alt="logo" className="h-8 w-8 rounded-lg object-contain border border-slate-100" />
                                : <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-black" style={{ backgroundColor: form.primary_color }}>
                                    {(form.org_display_name || "T").charAt(0).toUpperCase()}
                                </div>
                            }
                            <span className="text-sm font-black text-[#1d1d1f]">{form.org_display_name || "Your Organization"}</span>
                            <div className="ml-auto flex gap-2">
                                <div className="w-5 h-5 rounded-full border-2 border-white shadow" style={{ backgroundColor: form.primary_color }} />
                                <div className="w-5 h-5 rounded-full border-2 border-white shadow" style={{ backgroundColor: form.accent_color }} />
                            </div>
                        </div>
                    </div>

                    <button type="submit" disabled={pending}
                        className="w-full px-4 py-2.5 rounded-xl bg-[#0c64ef] text-white text-sm font-black hover:bg-[#005bb7] transition-colors disabled:opacity-50">
                        {pending ? "Saving…" : "Save branding"}
                    </button>
                </div>
            </form>
        </UpgradeGate>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">{title}</div>
            <div className="space-y-3">{children}</div>
        </div>
    );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
    label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
    return (
        <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none" />
        </div>
    );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
            <div className="flex items-center gap-2">
                <input type="color" value={value} onChange={e => onChange(e.target.value)}
                    className="w-10 h-10 rounded-xl border border-slate-200 cursor-pointer p-1" />
                <div className="flex gap-1.5 flex-wrap">
                    {PRESET_COLORS.map(c => (
                        <button key={c} type="button" onClick={() => onChange(c)}
                            className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${value === c ? "border-slate-400 scale-110" : "border-transparent"}`}
                            style={{ backgroundColor: c }} />
                    ))}
                </div>
                <code className="text-xs font-mono text-slate-500 ml-auto">{value}</code>
            </div>
        </div>
    );
}
