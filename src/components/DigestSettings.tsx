'use client';

import React, { useEffect, useState } from 'react';
import { getDigestPreferences, updateDigestPreferences, DigestPreferences } from '@/app/actions/actions';
import { cn } from '@/lib/utils';
import { Loader2, Bell, Slack, Mail, Clock, Globe, Calendar } from 'lucide-react';
import { toast } from 'sonner';

export function DigestSettings() {
    const [prefs, setPrefs] = useState<Partial<DigestPreferences>>({
        channel: 'email',
        send_time: '08:00',
        timezone: 'Asia/Kolkata',
        send_on_weekends: false,
        is_active: true
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await getDigestPreferences();
                if (data) setPrefs(data);
            } catch (err) {
                console.error(err);
                toast.error("Failed to load digest preferences");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateDigestPreferences(prefs);
            toast.success("Preferences updated successfully");
        } catch (err) {
            console.error(err);
            toast.error("Failed to save preferences");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-6 h-6 animate-spin text-[#0c64ef]" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#f5f5f7] rounded-3xl p-8 border border-[#e5e5ea]/50">
                <div className="flex items-start gap-4 mb-8">
                    <div className="p-3 bg-white rounded-2xl shadow-sm border border-[#e5e5ea]">
                        <Bell className="w-5 h-5 text-[#0c64ef]" />
                    </div>
                    <div>
                        <h4 className="text-lg font-black text-[#1d1d1f] tracking-tight mb-1">Daily Task Digest</h4>
                        <p className="text-sm font-medium text-[#86868b]">Receive a summary of your tasks every morning.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Channel */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-[#86868b] uppercase tracking-widest flex items-center gap-2">
                             <Mail className="w-3 h-3" /> Delivery Channel
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['email', 'slack', 'both', 'none'] as const).map(c => (
                                <button
                                    key={c}
                                    onClick={() => setPrefs({ ...prefs, channel: c })}
                                    className={cn(
                                        "px-4 py-3 rounded-2xl text-xs font-bold transition-all duration-300 border-2",
                                        prefs.channel === c
                                            ? "bg-white border-[#0c64ef] text-[#0c64ef] shadow-md"
                                            : "bg-[#f5f5f7] border-transparent text-[#86868b] hover:bg-white hover:border-[#e5e5ea]"
                                    )}
                                >
                                    {c.charAt(0).toUpperCase() + c.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Slack ID */}
                    {(prefs.channel === 'slack' || prefs.channel === 'both') && (
                        <div className="space-y-4 animate-in zoom-in-95 duration-300">
                            <label className="text-[10px] font-black text-[#86868b] uppercase tracking-widest flex items-center gap-2">
                                <Slack className="w-3 h-3" /> Slack User ID
                            </label>
                            <input
                                type="text"
                                value={prefs.slack_user_id || ''}
                                onChange={(e) => setPrefs({ ...prefs, slack_user_id: e.target.value })}
                                placeholder="e.g. U0123456789"
                                className="w-full bg-white border border-[#e5e5ea] rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c64ef]/20 focus:border-[#0c64ef] transition-all"
                            />
                        </div>
                    )}

                    {/* Send Time */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-[#86868b] uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-3 h-3" /> Send Time
                        </label>
                        <input
                            type="time"
                            value={prefs.send_time || '08:00'}
                            onChange={(e) => setPrefs({ ...prefs, send_time: e.target.value })}
                            className="w-full bg-white border border-[#e5e5ea] rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c64ef]/20 focus:border-[#0c64ef] transition-all"
                        />
                    </div>

                    {/* Timezone */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-black text-[#86868b] uppercase tracking-widest flex items-center gap-2">
                            <Globe className="w-3 h-3" /> Timezone
                        </label>
                        <select
                            value={prefs.timezone || 'Asia/Kolkata'}
                            onChange={(e) => setPrefs({ ...prefs, timezone: e.target.value })}
                            className="w-full bg-white border border-[#e5e5ea] rounded-2xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#0c64ef]/20 focus:border-[#0c64ef] transition-all appearance-none cursor-pointer"
                        >
                            <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                            <option value="UTC">UTC</option>
                            <option value="America/New_York">America/New_York (EST)</option>
                            <option value="Europe/London">Europe/London (GMT)</option>
                        </select>
                    </div>
                </div>

                <div className="mt-10 pt-8 border-t border-[#e5e5ea]/50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setPrefs({ ...prefs, send_on_weekends: !prefs.send_on_weekends })}
                            className={cn(
                                "w-12 h-6 rounded-full transition-all duration-300 relative",
                                prefs.send_on_weekends ? "bg-[#16a34a]" : "bg-[#86868b]/20"
                            )}
                        >
                            <div className={cn(
                                "w-4 h-4 bg-white rounded-full absolute top-1 transition-all duration-300",
                                prefs.send_on_weekends ? "left-7" : "left-1"
                            )} />
                        </button>
                        <span className="text-xs font-bold text-[#1d1d1f] flex items-center gap-2">
                            <Calendar className="w-3 h-3" /> Send on weekends
                        </span>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-[#1d1d1f] hover:bg-[#000] text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all duration-300 flex items-center gap-2 disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Preferences"}
                    </button>
                </div>
            </div>
        </div>
    );
}
