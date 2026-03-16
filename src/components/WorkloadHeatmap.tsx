'use client';

import React, { useState } from 'react';
import { addDays, startOfWeek, format } from 'date-fns';
import { WorkloadMap } from '@/app/actions/actions';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

type Mode = 'tasks' | 'hours' | 'urgency';

const THRESHOLDS = {
    tasks: [2, 4, 6],    // low / medium / high / critical
    hours: [2, 5, 8],
    urgency: [20, 45, 70],
};

function getHeatLevel(value: number | null, metric: Mode) {
    if (value === null) return 'free';
    const [low, mid, high] = THRESHOLDS[metric];
    if (value <= low) return 'free';       
    if (value <= mid) return 'moderate';   
    if (value <= high) return 'busy';       
    return 'overloaded';                    
}

const heatColors = {
    free: { bg: 'bg-[#dcfce7]', text: 'text-[#16a34a]' },       // Green 100/700
    moderate: { bg: 'bg-[#fef9c3]', text: 'text-[#ca8a04]' },   // Yellow 100/700
    busy: { bg: 'bg-[#ffedd5]', text: 'text-[#ea580c]' },       // Orange 100/700
    overloaded: { bg: 'bg-[#fee2e2]', text: 'text-[#e83f3f]' }, // Red 100/700
};

export function WorkloadHeatmap({ data }: { data: WorkloadMap }) {
    const [mode, setMode] = useState<Mode>('tasks');
    const [hoveredCell, setHoveredCell] = useState<{
        userId: string;
        userName: string;
        date: Date;
        value: number | null;
        x: number;
        y: number;
    } | null>(null);

    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    const getMetricLabel = (m: Mode) => {
        if (m === 'tasks') return 'Task count';
        if (m === 'hours') return 'Hours logged';
        return 'Urgency score';
    };

    const handleMouseMove = (e: React.MouseEvent, userId: string, userName: string, date: Date, value: number | null) => {
        setHoveredCell({
            userId,
            userName,
            date,
            value,
            x: e.clientX,
            y: e.clientY
        });
    };

    return (
        <div className="relative bg-white rounded-[32px] border border-[#e5e5ea] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
            {/* Tooltip */}
            <AnimatePresence>
                {hoveredCell && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        style={{ 
                            position: 'fixed', 
                            left: hoveredCell.x + 15, 
                            top: hoveredCell.y + 15,
                            zIndex: 1000
                        }}
                        className="pointer-events-none"
                    >
                        <div className="bg-[#1d1d1f] text-white p-4 rounded-2xl shadow-2xl border border-white/10 backdrop-blur-xl min-w-[200px]">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[10px] font-black">
                                    {hoveredCell.userName.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/50 truncate">
                                        {hoveredCell.userName}
                                    </p>
                                    <p className="text-xs font-bold">{format(hoveredCell.date, 'EEEE, MMM do')}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/10">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{getMetricLabel(mode)}</span>
                                <span className="text-sm font-black text-[#0071e3]">
                                    {hoveredCell.value === null ? 'No data' : hoveredCell.value}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div>
                    <h3 className="text-2xl font-black text-[#1d1d1f] tracking-tight mb-1">Team Capacity</h3>
                    <p className="text-sm font-medium text-[#86868b]">Identify workload peaks and capacity gaps at a glance.</p>
                </div>
                
                <div className="flex p-1 bg-[#f5f5f7] rounded-2xl w-fit">
                    {(['tasks', 'hours', 'urgency'] as Mode[]).map(m => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={cn(
                                "px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all duration-300 rounded-xl",
                                mode === m
                                    ? "bg-white text-[#0071e3] shadow-[0_4px_12px_rgba(0,0,0,0.08)] scale-[1.02]"
                                    : "text-[#86868b] hover:text-[#1d1d1f]"
                            )}
                        >
                            {getMetricLabel(m)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="overflow-x-auto -mx-8 px-8">
                <table className="w-full border-separate border-spacing-y-2">
                    <thead>
                        <tr>
                            <th className="text-left text-[10px] font-black text-[#86868b] uppercase tracking-[0.2em] pb-4 pl-4 w-48">Member</th>
                            {days.map(d => (
                                <th key={d.toISOString()} className="text-center text-[10px] font-black text-[#86868b] uppercase tracking-[0.2em] pb-4 px-2">
                                    <span className="block text-[#1d1d1f] mb-1">{format(d, 'EEE')}</span>
                                    <span className="opacity-40">{format(d, 'd')}</span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(data).length === 0 ? (
                            <tr>
                                <td colSpan={8} className="py-12 text-center text-sm font-medium text-[#86868b] bg-[#f5f5f7] rounded-[24px]">
                                    No workload data available for this week.
                                </td>
                            </tr>
                        ) : (
                            Object.entries(data).map(([userId, member]) => (
                                <tr key={userId} className="group">
                                    <td className="py-2 pl-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1d1d1f] to-[#434343] flex items-center justify-center text-xs font-black text-white shadow-sm transition-transform group-hover:scale-110">
                                                {member.name.charAt(0)}
                                            </div>
                                            <span className="text-sm font-bold text-[#1d1d1f] group-hover:text-[#0071e3] transition-colors truncate max-w-[120px]">
                                                {member.name}
                                            </span>
                                        </div>
                                    </td>
                                    {days.map(d => {
                                        const dateKey = format(d, 'yyyy-MM-dd');
                                        const dayData = member.days[dateKey];
                                        const value = dayData ? dayData[mode] : null;
                                        const level = getHeatLevel(value, mode);
                                        const colors = heatColors[level];

                                        return (
                                            <td key={dateKey} className="py-2 px-1">
                                                <div 
                                                    className={cn(
                                                        "w-full aspect-square min-w-[44px] min-h-[44px] rounded-2xl flex flex-col items-center justify-center transition-all duration-300 cursor-default border-2 border-transparent hover:border-white hover:shadow-lg hover:-translate-y-1",
                                                        colors.bg,
                                                        colors.text
                                                    )}
                                                    onMouseMove={(e) => handleMouseMove(e, userId, member.name, d, value)}
                                                    onMouseLeave={() => setHoveredCell(null)}
                                                >
                                                    <span className="text-sm font-black">
                                                        {value === null ? '·' : value}
                                                    </span>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between mt-10 p-6 bg-[#f5f5f7] rounded-2xl border border-[#e5e5ea]">
                <div className="flex items-center gap-6">
                    <span className="text-[10px] font-black text-[#86868b] uppercase tracking-widest">Heat Map Scale</span>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-lg bg-[#dcfce7] border border-[#16a34a]/20" />
                            <span className="text-[10px] font-bold text-[#1d1d1f]">Ideal</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-lg bg-[#fef9c3] border border-[#ca8a04]/20" />
                            <span className="text-[10px] font-bold text-[#1d1d1f]">Moderate</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-lg bg-[#ffedd5] border border-[#ea580c]/20" />
                            <span className="text-[10px] font-bold text-[#1d1d1f]">Busy</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-lg bg-[#fee2e2] border border-[#e83f3f]/20" />
                            <span className="text-[10px] font-bold text-[#1d1d1f]">Critical</span>
                        </div>
                    </div>
                </div>
                
                <div className="hidden lg:flex items-center gap-2 text-[10px] font-bold text-[#86868b]">
                    <span className="p-1 px-2 bg-white rounded-lg border border-[#e5e5ea]">Pro Tip</span>
                    <span>Hover over any cell for detailed daily stats.</span>
                </div>
            </div>
        </div>
    );
}
