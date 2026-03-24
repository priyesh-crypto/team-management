"use client";

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, Button } from '@/components/ui/components';
import { updateProfile, changePassword } from '@/app/actions/actions';

const DigestSettings = dynamic(() => import('@/components/DigestSettings').then(m => ({ default: m.DigestSettings })), { 
    ssr: false,
    loading: () => <div className="h-64 w-full animate-pulse bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-slate-400">Loading Settings...</div>
});

interface SettingsViewProps {
    userId: string;
    userName: string;
    initialProfileName: string;
    isManager?: boolean;
}

export function SettingsView({ userId, userName, initialProfileName, isManager = false }: SettingsViewProps) {
    const [profileName, setProfileName] = useState(initialProfileName);
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [passwords, setPasswords] = useState({ new: '', confirm: '' });
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

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
                <div className="w-16 h-16 bg-[#0071e3] rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-sm">
                    {(profileName || userName).charAt(0)}
                </div>
                <div>
                    <h2 className="text-xl font-black text-[#1d1d1f] tracking-tight">{profileName || userName}</h2>
                    <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest leading-none mt-1">
                        {isManager ? 'Workspace Admin' : 'Team Member'}
                    </p>
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
                                className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold outline-none focus:ring-1 ring-[#0071e3]" 
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
                                    className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold outline-none focus:ring-1 ring-[#0071e3]" 
                                    placeholder="••••••••" 
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Confirm</label>
                                <input 
                                    type="password" 
                                    value={passwords.confirm} 
                                    onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} 
                                    className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold outline-none focus:ring-1 ring-[#0071e3]" 
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
