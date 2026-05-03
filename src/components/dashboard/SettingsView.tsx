"use client";

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/components';
import { updateProfile, changePassword, uploadAvatar } from '@/app/actions/actions';
import { DataSummaryTable } from '@/components/dashboard/DataSummaryTable';
import { RequestExportButton, RequestDeletionButton } from '@/components/dashboard/GdprControls';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { CreditCard, Palette, Shield, Users as UsersIcon, Plug, FileText, Download, ChevronRight } from 'lucide-react';

const DigestSettings = dynamic(() => import('@/components/DigestSettings').then(m => ({ default: m.DigestSettings })), { 
    ssr: false,
    loading: () => <div className="h-64 w-full animate-pulse bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-slate-400">Loading Settings...</div>
});

interface SettingsViewProps {
    userId: string;
    userName: string;
    initialProfileName: string;
    initialAvatarUrl?: string | null;
    isManager?: boolean;
}

export function SettingsView({ userId, userName, initialProfileName, initialAvatarUrl, isManager = false }: SettingsViewProps) {
    const [profileName, setProfileName] = useState(initialProfileName);
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [passwords, setPasswords] = useState({ new: '', confirm: '' });
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(initialAvatarUrl);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsUploadingAvatar(true);
        setProfileMsg(null);
        try {
            const fd = new FormData();
            fd.append('avatar', file);
            const res = await uploadAvatar(fd);
            if (res.error) {
                setProfileMsg({ type: 'error', text: res.error });
            } else {
                setAvatarUrl(res.url);
                setProfileMsg({ type: 'success', text: 'Profile picture updated!' });
            }
        } catch (err: any) {
            setProfileMsg({ type: 'error', text: err.message || 'Upload failed.' });
        } finally {
            setIsUploadingAvatar(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUpdatingProfile(true);
        setProfileMsg(null);
        try {
            const res = await updateProfile(userId, { name: profileName });
            if (res && res.error) {
                setProfileMsg({ type: 'error', text: res.error });
            } else {
                setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
            }
        } catch (err: any) {
            setProfileMsg({ type: 'error', text: err.message || 'An unexpected error occurred.' });
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            setProfileMsg({ type: 'error', text: 'Passwords do not match.' });
            return;
        }
        setIsUpdatingPassword(true);
        try {
            const res = await changePassword(passwords.new);
            if (res && res.error) {
                setProfileMsg({ type: 'error', text: res.error });
            } else {
                setProfileMsg({ type: 'success', text: 'Password changed successfully!' });
                setPasswords({ new: '', confirm: '' });
            }
        } catch (err: any) {
            setProfileMsg({ type: 'error', text: err.message || 'An unexpected error occurred.' });
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6 py-4 pb-20">
            <div className="flex items-center gap-6 mb-10 pb-8 border-b border-[#f0f0f2]">
                <div className="relative group shrink-0">
                    <UserAvatar
                        name={profileName || userName}
                        avatarUrl={avatarUrl}
                        className="w-16 h-16 rounded-2xl bg-[#0051e6] shadow-sm"
                        textClassName="text-white text-2xl font-black"
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity disabled:cursor-wait"
                        title="Change photo"
                    >
                        {isUploadingAvatar
                            ? <span className="text-white text-[10px] font-black">...</span>
                            : <span className="text-white text-lg">📷</span>
                        }
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarUpload} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-[#1d1d1f] tracking-tight">{profileName || userName}</h2>
                    <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest leading-none mt-1">
                        {isManager ? 'Workspace Admin' : 'Team Member'}
                    </p>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingAvatar}
                        className="mt-2 text-[9px] font-black uppercase tracking-widest text-[#0051e6] hover:underline disabled:opacity-50"
                    >
                        {isUploadingAvatar ? 'Uploading...' : 'Change photo'}
                    </button>
                </div>
            </div>

            {profileMsg && (
                <div className={`p-4 rounded-2xl text-[11px] font-bold uppercase tracking-widest ${
                    profileMsg.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                }`}>
                    {profileMsg.text}
                </div>
            )}

            <div className="grid grid-cols-1 gap-12">
                <section>
                    <h3 className="text-[10px] font-black text-[#86868b] uppercase tracking-[0.3em] mb-6">Task Digest</h3>
                    <DigestSettings />
                </section>

                {/* ── Privacy & Data ─────────────────────────────── */}
                <section>
                    <h3 className="text-[10px] font-black text-[#86868b] uppercase tracking-[0.3em] mb-6">Privacy &amp; Data</h3>
                    <div className="space-y-4">

                        <Card className="p-6 rounded-2xl border-[#eceef0]">
                            <h4 className="text-[10px] font-black mb-1 text-[#1d1d1f] uppercase tracking-widest flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-[#f5f5f7] flex items-center justify-center text-xs">📦</span>
                                Download your data
                            </h4>
                            <p className="text-[11px] text-[#86868b] mb-4 leading-relaxed">
                                Get a copy of everything we hold about you — tasks, comments, audit
                                activity, and preferences — as a JSON file.
                            </p>
                            <RequestExportButton />
                        </Card>

                        <Card className="p-6 rounded-2xl border-[#eceef0]">
                            <h4 className="text-[10px] font-black mb-1 text-[#1d1d1f] uppercase tracking-widest flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center text-xs">🗑</span>
                                Delete your account
                            </h4>
                            <p className="text-[11px] text-[#86868b] mb-4 leading-relaxed">
                                Your personal details will be anonymised immediately. Tasks you
                                created stay visible to your team, attributed to &ldquo;Deleted User&rdquo;.
                                This cannot be undone.
                            </p>
                            <RequestDeletionButton />
                        </Card>

                        <Card className="p-6 rounded-2xl border-[#eceef0] bg-[#fafafa]">
                            <h4 className="text-[10px] font-black mb-4 text-[#1d1d1f] uppercase tracking-widest flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-[#f5f5f7] flex items-center justify-center text-xs">🔍</span>
                                What we store about you
                            </h4>
                            <DataSummaryTable />
                        </Card>

                    </div>
                </section>

                {isManager && (
                    <Card className="p-6 rounded-2xl border-[#eceef0]">
                        <h3 className="text-[10px] font-black mb-4 text-[#1d1d1f] uppercase tracking-widest flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-[#f5f5f7] flex items-center justify-center text-xs">⚙️</span>
                            Workspace Administration
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[
                                { href: "/dashboard/settings/billing",      label: "Billing & Plans",   desc: "Subscription, seats, invoices",        icon: <CreditCard size={14} /> },
                                { href: "/dashboard/settings/branding",     label: "Branding",          desc: "Logo, colors, custom domain",          icon: <Palette size={14} /> },
                                { href: "/dashboard/settings/sso",          label: "Single Sign-On",    desc: "SAML / OIDC configuration",            icon: <Shield size={14} /> },
                                { href: "/dashboard/settings/roles",        label: "Custom Roles",      desc: "Fine-grained permissions",             icon: <UsersIcon size={14} /> },
                                { href: "/dashboard/settings/integrations", label: "Integrations & API", desc: "Webhooks, API keys, Slack, GitHub",   icon: <Plug size={14} /> },
                                { href: "/dashboard/settings/audit",        label: "Audit Log",         desc: "Org-wide activity history",            icon: <FileText size={14} /> },
                                { href: "/dashboard/settings/export",       label: "Data Export",       desc: "Download tasks, members, time logs",   icon: <Download size={14} /> },
                            ].map(item => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="group flex items-center gap-3 p-3 rounded-xl border border-[#eceef0] bg-white hover:border-[#0051e6]/30 hover:bg-[#0051e6]/3 transition-colors"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-[#f5f5f7] flex items-center justify-center text-[#1d1d1f] group-hover:bg-[#0051e6]/10 group-hover:text-[#0051e6] transition-colors">
                                        {item.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-black text-[#1d1d1f] truncate">{item.label}</div>
                                        <div className="text-[10px] text-[#86868b] truncate">{item.desc}</div>
                                    </div>
                                    <ChevronRight size={14} className="text-[#86868b] group-hover:text-[#0051e6] flex-shrink-0" />
                                </Link>
                            ))}
                        </div>
                    </Card>
                )}

                <Card className="p-6 rounded-2xl border-[#eceef0]">
                    <h3 className="text-[10px] font-black mb-6 text-[#1d1d1f] uppercase tracking-widest flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[#f5f5f7] flex items-center justify-center text-xs">👤</span>
                        Profile Details
                    </h3>
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Full Name</label>
                            <input 
                                value={profileName} 
                                onChange={e => setProfileName(e.target.value)} 
                                className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold outline-none focus:ring-1 ring-[#0051e6]" 
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={isUpdatingProfile} 
                            className="w-full h-10 rounded-xl bg-[#1d1d1f] text-white font-black tracking-widest text-[10px] mt-2 hover:bg-black transition-colors disabled:opacity-50"
                        >
                            {isUpdatingProfile ? 'UPDATING...' : 'SAVE CHANGES'}
                        </button>
                    </form>
                </Card>

                <Card className="p-6 rounded-2xl border-[#eceef0]">
                    <h3 className="text-[10px] font-black mb-6 text-[#1d1d1f] uppercase tracking-widest flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-[#f5f5f7] flex items-center justify-center text-xs">🔒</span>
                        Security
                    </h3>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">New Password</label>
                                <input 
                                    type="password" 
                                    value={passwords.new} 
                                    onChange={e => setPasswords({ ...passwords, new: e.target.value })} 
                                    className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold outline-none focus:ring-1 ring-[#0051e6]" 
                                    placeholder="••••••••" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Confirm</label>
                                <input 
                                    type="password" 
                                    value={passwords.confirm} 
                                    onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} 
                                    className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold outline-none focus:ring-1 ring-[#0051e6]" 
                                    placeholder="••••••••" 
                                />
                            </div>
                        </div>
                        <button 
                            type="submit" 
                            disabled={isUpdatingPassword} 
                            className="w-full h-10 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] font-black tracking-widest text-[10px] border border-[#e5e5ea] hover:bg-[#e5e5ea] transition-colors mt-2 disabled:opacity-50"
                        >
                            {isUpdatingPassword ? 'UPDATING...' : 'CHANGE PASSWORD'}
                        </button>
                    </form>
                </Card>
            </div>
        </div>
    );
}
