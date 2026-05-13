"use client";

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Zap, ArrowRight } from 'lucide-react';
import { predictTaskStatus } from '@/utils/predictive-engine';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/UserAvatar';
import type { Task, Subtask, Profile } from '@/app/actions/actions';

interface Props {
    tasks: Task[];
    subtasksMap: Record<string, Subtask[]>;
    employees: Profile[];
    onRebalance: (id: string, name: string) => void;
}

export function OverloadAlerts({ tasks, subtasksMap, employees, onRebalance }: Props) {
    const alerts = useMemo(() => {
        return employees.map(e => {
            const mt = tasks.filter(t => t.employee_id === e.id && t.status !== 'Blocked');
            const active = mt.filter(t => t.status !== 'Completed');
            
            // Real-time Prediction Analytics
            const predictions = active.map(t => predictTaskStatus(t, subtasksMap[t.id] || []));
            const delayedCount = predictions.filter(p => p.level === 'Delayed').length;
            const atRiskCount = predictions.filter(p => p.level === 'At Risk').length;
            const overdueCount = predictions.filter(p => p.level === 'Overdue').length;
            
            // Advanced Risk Score Calculation (Predictive)
            // Overdue: 4pts, Delayed: 3pts, At Risk: 1.5pts, General Load: 1pt
            const score = (overdueCount * 4) + (delayedCount * 3) + (atRiskCount * 1.5) + (active.length * 1);
            
            let level: 'Critical' | 'High' | 'Moderate' | 'Low' = 'Low';
            let color = 'text-green-500 bg-green-50';
            
            if (score >= 12) {
                level = 'Critical';
                color = 'text-[#ff3b30] bg-[#ff3b30]/10';
            } else if (score >= 7) {
                level = 'High';
                color = 'text-[#ff9500] bg-[#ff9500]/10';
            } else if (score >= 4) {
                level = 'Moderate';
                color = 'text-[#0051e6] bg-[#0051e6]/10';
            }
            
            return { 
                id: e.id, 
                name: e.name, 
                avatar: e.avatar_url,
                score: Math.round(score * 10) / 10, 
                level, 
                color,
                activeCount: active.length,
                overdueCount,
                delayedCount,
                atRiskCount
            };
        })
        .filter(a => a.level !== 'Low')
        .sort((a, b) => b.score - a.score);
    }, [tasks, subtasksMap, employees]);

    if (alerts.length === 0) return null;

    return (
        <div className="space-y-4 mb-8">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#ff3b30]/10 flex items-center justify-center text-[#ff3b30]">
                        <AlertTriangle size={16} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-[#1d1d1f] tracking-tight uppercase">Burnout Risk Center</h3>
                        <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mt-0.5">AI-powered workload monitoring</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {alerts.map((alert, idx) => (
                    <motion.div 
                        key={alert.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white rounded-[28px] p-5 border border-[#eceef0] shadow-sm hover:shadow-xl hover:shadow-[#0c64ef]/5 transition-all duration-500 relative overflow-hidden group"
                    >
                        <div className={cn("absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12 opacity-10", alert.level === 'Critical' ? 'bg-[#ff3b30]' : 'bg-[#0051e6]')} />
                        
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <UserAvatar 
                                        name={alert.name} 
                                        avatarUrl={alert.avatar}
                                        className="w-10 h-10 rounded-xl shadow-sm bg-[#f5f5f7]"
                                        textClassName="text-[12px] font-black"
                                    />
                                    <div>
                                        <div className="text-[13px] font-black text-[#1d1d1f] leading-tight">{alert.name}</div>
                                        <div className={cn("text-[9px] font-black uppercase tracking-widest mt-0.5", alert.level === 'Critical' ? 'text-[#ff3b30]' : 'text-[#86868b]')}>
                                            {alert.level} RISK
                                        </div>
                                    </div>
                                </div>
                                <div className={cn("px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider", alert.color)}>
                                    Score: {alert.score}
                                </div>
                            </div>

                            <div className="space-y-3 mb-6">
                                <div className="flex items-center justify-between text-[11px] font-bold">
                                    <span className="text-[#86868b]">Active Workload</span>
                                    <span className="text-[#1d1d1f]">{alert.activeCount} tasks</span>
                                </div>
                                {alert.delayedCount > 0 && (
                                    <div className="flex items-center justify-between text-[11px] font-bold">
                                        <span className="text-[#ff3b30]">Predicted Delays</span>
                                        <span className="text-[#ff3b30]">{alert.delayedCount} tasks</span>
                                    </div>
                                )}
                                {alert.atRiskCount > 0 && (
                                    <div className="flex items-center justify-between text-[11px] font-bold">
                                        <span className="text-[#ff9500]">Slipping Pace</span>
                                        <span className="text-[#ff9500]">{alert.atRiskCount} tasks</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between text-[11px] font-bold">
                                    <span className="text-[#86868b]">Past Deadlines</span>
                                    <span className={cn(alert.overdueCount > 0 ? "text-[#ff3b30]" : "text-[#1d1d1f]")}>{alert.overdueCount}</span>
                                </div>
                            </div>

                            <button 
                                onClick={() => onRebalance(alert.id, alert.name)}
                                className="w-full h-10 rounded-xl bg-[#0051e6] text-white text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-[#005bb7] transition-all hover:shadow-lg hover:shadow-[#0051e6]/20 active:scale-[0.98]"
                            >
                                <Zap size={14} fill="currentColor" />
                                Smart Rebalance
                                <ArrowRight size={14} />
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
