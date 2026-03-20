'use client';

import React, { useState } from 'react';
import { addDays, startOfWeek, format, isSameDay } from 'date-fns';
import { WorkloadMap, getDailyWorkDetails, WorkDetail } from '@/app/actions/actions';
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

    const [selectedCell, setSelectedCell] = useState<{
        userId: string;
        userName: string;
        date: Date;
    } | null>(null);
    const [details, setDetails] = useState<WorkDetail[]>([]);
    const [detailsLoading, setDetailsLoading] = useState(false);

    React.useEffect(() => {
        if (selectedCell) {
            setDetailsLoading(true);
            getDailyWorkDetails(selectedCell.userId, format(selectedCell.date, 'yyyy-MM-dd'))
                .then(res => {
                    setDetails(res);
                    setDetailsLoading(false);
                })
                .catch(() => setDetailsLoading(false));
        }
    }, [selectedCell]);

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
        <div className="relative bg-white rounded-[24px] border border-[#e5e5ea] p-5 shadow-sm">
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

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                    <h3 className="text-base font-black text-[#1d1d1f] tracking-tight mb-0.5">Team Capacity</h3>
                    <p className="text-xs font-medium text-[#86868b]">Weekly workload overview</p>
                </div>
                
                <div className="flex p-0.5 bg-[#f5f5f7] rounded-xl w-fit">
                    {(['tasks', 'hours', 'urgency'] as Mode[]).map(m => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={cn(
                                "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all duration-300 rounded-lg",
                                mode === m
                                    ? "bg-white text-[#0071e3] shadow-sm"
                                    : "text-[#86868b] hover:text-[#1d1d1f]"
                            )}
                        >
                            {getMetricLabel(m)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full border-separate border-spacing-y-2">
                    <thead>
                        <tr>
                            <th className="text-left text-[10px] font-black text-[#86868b] uppercase tracking-[0.2em] pb-4 pl-4 w-48">Member</th>
                            {days.map(d => (
                                <th key={d.toISOString()} className="text-center text-[9px] font-black text-[#86868b] uppercase tracking-wider pb-3 px-1">
                                    <span className="block text-[#1d1d1f] mb-0.5">{format(d, 'EEE')}</span>
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
                                    <td className="py-1 pl-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1d1d1f] to-[#434343] flex items-center justify-center text-[9px] font-black text-white">
                                                {member.name.charAt(0)}
                                            </div>
                                            <span className="text-xs font-bold text-[#1d1d1f] truncate max-w-[100px]">
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
                                        const isSelected = selectedCell && isSameDay(selectedCell.date, d) && selectedCell.userId === userId;

                                        return (
                                            <td key={dateKey} className="py-1 px-0.5">
                                                <div 
                                                    className={cn(
                                                        "w-full h-10 min-w-[36px] rounded-lg flex items-center justify-center transition-all duration-200 cursor-pointer border hover:shadow-md hover:-translate-y-0.5",
                                                        colors.bg,
                                                        colors.text,
                                                        isSelected ? "ring-2 ring-offset-1 ring-[#0071e3] scale-105" : "border-transparent"
                                                    )}
                                                    onMouseEnter={() => {
                                                        // Pre-fetch detail data on hover for instant click feel
                                                        getDailyWorkDetails(userId, dateKey);
                                                    }}
                                                    onMouseMove={(e) => handleMouseMove(e, userId, member.name, d, value)}
                                                    onMouseLeave={() => setHoveredCell(null)}
                                                    onClick={() => setSelectedCell({ userId, userName: member.name, date: d })}
                                                >
                                                    <span className="text-xs font-black">
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

            {/* Drill-down Detail Panel */}
            <AnimatePresence>
                {selectedCell && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-8 border-t border-[#e5e5ea] pt-8"
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-[20px] bg-[#0071e3] flex items-center justify-center text-white text-lg font-black shadow-lg shadow-[#0071e3]/20">
                                    {selectedCell.userName.charAt(0)}
                                </div>
                                <div>
                                    <h4 className="text-xl font-black text-[#1d1d1f] tracking-tight">
                                        Work Details for {selectedCell.userName}
                                    </h4>
                                    <p className="text-sm font-medium text-[#86868b]">
                                        {format(selectedCell.date, 'EEEE, MMMM do, yyyy')}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setSelectedCell(null)}
                                className="p-2 hover:bg-[#f5f5f7] rounded-full transition-colors group"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[#86868b] group-hover:text-[#1d1d1f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {detailsLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="bg-white p-6 rounded-[28px] border border-[#e5e5ea] animate-pulse">
                                        <div className="flex justify-between mb-4">
                                            <div className="h-4 w-20 bg-[#f5f5f7] rounded-full"></div>
                                            <div className="h-4 w-12 bg-[#f5f5f7] rounded-full"></div>
                                        </div>
                                        <div className="h-5 w-3/4 bg-[#f5f5f7] rounded-lg mb-2"></div>
                                        <div className="h-4 w-full bg-[#f5f5f7] rounded-lg mb-6"></div>
                                        <div className="pt-4 border-t border-[#f5f5f7] flex justify-between">
                                            <div className="h-3 w-16 bg-[#f5f5f7] rounded-full"></div>
                                            <div className="h-5 w-10 bg-[#f5f5f7] rounded-full"></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : details.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-[#f5f5f7] rounded-[32px] border border-[#e5e5ea] border-dashed">
                                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mb-4 shadow-sm">
                                    <span className="text-2xl">☕</span>
                                </div>
                                <h5 className="text-sm font-bold text-[#1d1d1f] mb-1">No activity logged</h5>
                                <p className="text-xs font-medium text-[#86868b]">Seems like {selectedCell.userName} took a well-deserved break.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {details.map((detail, idx) => (
                                    <div key={idx} className="group/card bg-white p-6 rounded-[28px] border border-[#e5e5ea] hover:border-[#0071e3] hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] transition-all duration-300">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-[10px] font-black text-[#0071e3] uppercase tracking-[0.2em] bg-[#0071e3]/5 px-3 py-1 rounded-full">
                                                Task Record
                                            </span>
                                            <span className="text-[10px] font-bold text-[#86868b]">
                                                {format(new Date(detail.created_at), 'h:mm a')}
                                            </span>
                                        </div>
                                        <h5 className="text-[15px] font-black text-[#1d1d1f] tracking-tight mb-2 line-clamp-1 group-hover/card:text-[#0071e3] transition-colors">
                                            {detail.task_name}
                                        </h5>
                                        <p className="text-sm font-medium text-[#86868b] mb-6 line-clamp-2 leading-relaxed">
                                            {detail.subtask_name}
                                        </p>
                                        <div className="flex items-center justify-between pt-4 border-t border-[#f5f5f7]">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-[#34c759] shadow-[0_0_8px_rgba(52,199,89,0.4)]"></div>
                                                <span className="text-[10px] font-black text-[#86868b] uppercase tracking-widest">Time Logged</span>
                                            </div>
                                            <span className="text-lg font-black text-[#1d1d1f] tracking-tighter">
                                                {detail.hours_spent} <span className="text-[10px] text-[#86868b] tracking-normal font-bold">hrs</span>
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="flex items-center justify-between mt-5 p-3 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea]">
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
