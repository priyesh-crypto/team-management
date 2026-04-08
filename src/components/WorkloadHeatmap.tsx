'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { addDays, startOfWeek, format, isSameDay, addWeeks } from 'date-fns';
import { WorkloadMap, getDailyWorkDetails, getWorkloadHeatmap, WorkDetail } from '@/app/actions/actions';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Users, AlertTriangle, TrendingUp, CheckCircle2, Loader2 } from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';

type Mode = 'tasks' | 'hours' | 'urgency';

const THRESHOLDS = {
    tasks:   [2, 4, 6],
    hours:   [2, 5, 8],
    urgency: [20, 45, 70],
};

// Max values used to size the per-member utilization bar
const BAR_MAX = { tasks: 35, hours: 56, urgency: 280 }; // 7 days × threshold[2]

function getHeatLevel(value: number | null, metric: Mode) {
    if (value === null) return 'free';
    const [low, mid, high] = THRESHOLDS[metric];
    if (value <= low)  return 'free';
    if (value <= mid)  return 'moderate';
    if (value <= high) return 'busy';
    return 'overloaded';
}

const HEAT_COLORS = {
    free:       { bg: 'bg-[#ecfdf5]', border: 'border-[#10b981]/20', text: 'text-[#059669]', bar: 'bg-gradient-to-r from-[#10b981] to-[#059669]' },
    moderate:   { bg: 'bg-[#fffbeb]', border: 'border-[#f59e0b]/20', text: 'text-[#d97706]', bar: 'bg-gradient-to-r from-[#f59e0b] to-[#d97706]' },
    busy:       { bg: 'bg-[#fff7ed]', border: 'border-[#f97316]/20', text: 'text-[#ea580c]', bar: 'bg-gradient-to-r from-[#f97316] to-[#ea580c]' },
    overloaded: { bg: 'bg-[#fef2f2]', border: 'border-[#ef4444]/20', text: 'text-[#dc2626]', bar: 'bg-gradient-to-r from-[#ef4444] to-[#dc2626]' },
};

const STATUS_LABEL: Record<string, string> = {
    free: 'Available', moderate: 'Moderate', busy: 'Busy', overloaded: 'Overloaded',
};

// ─── Per-member weekly totals ─────────────────────────────────────────────────
function getMemberWeekTotals(memberData: WorkloadMap[string], metric: Mode) {
    return Object.values(memberData.days).reduce((sum, d) => sum + (d?.[metric] ?? 0), 0);
}

function getMemberPeakLevel(memberData: WorkloadMap[string], metric: Mode) {
    const dayValues = Object.values(memberData.days).map(d => d?.[metric] ?? 0);
    const peak = Math.max(...dayValues, 0);
    return getHeatLevel(peak, metric);
}

// ─── Team summary stats ───────────────────────────────────────────────────────
function buildTeamStats(data: WorkloadMap, metric: Mode) {
    const counts = { free: 0, moderate: 0, busy: 0, overloaded: 0 };
    Object.values(data).forEach(m => {
        counts[getMemberPeakLevel(m, metric)]++;
    });
    return counts;
}

export function WorkloadHeatmap({ data: initialData }: { data: WorkloadMap }) {
    const [mode, setMode]               = useState<Mode>('tasks');
    const [weekOffset, setWeekOffset]   = useState(0);
    const [data, setData]               = useState<WorkloadMap>(initialData);
    const [navigating, setNavigating]   = useState(false);

    const [hoveredCell, setHoveredCell] = useState<{
        userId: string; userName: string; date: Date; value: number | null; x: number; y: number;
    } | null>(null);

    const [selectedCell, setSelectedCell] = useState<{
        userId: string; userName: string; date: Date;
    } | null>(null);
    const [details, setDetails]         = useState<WorkDetail[]>([]);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Week bounds
    const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
    const days      = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const isCurrentWeek = weekOffset === 0;

    // Navigate weeks — re-fetch from the action
    const navigate = useCallback(async (delta: number) => {
        const nextOffset = weekOffset + delta;
        setNavigating(true);
        setSelectedCell(null);
        try {
            const fresh = await getWorkloadHeatmap(undefined, undefined, nextOffset);
            setData(fresh);
            setWeekOffset(nextOffset);
        } catch (e) {
            console.error('[WorkloadHeatmap] navigation failed', e);
        } finally {
            setNavigating(false);
        }
    }, [weekOffset]);

    // Sync when parent refreshes initial data (real-time updates) for current week
    useEffect(() => {
        if (weekOffset === 0) setData(initialData);
    }, [initialData, weekOffset]);

    // Drill-down detail panel
    useEffect(() => {
        if (!selectedCell) return;
        setDetailsLoading(true);
        getDailyWorkDetails(selectedCell.userId, format(selectedCell.date, 'yyyy-MM-dd'))
            .then(res => { setDetails(res); setDetailsLoading(false); })
            .catch(() => setDetailsLoading(false));
    }, [selectedCell]);

    const getMetricLabel = (m: Mode) =>
        m === 'tasks' ? 'Task count' : m === 'hours' ? 'Hours logged' : 'Urgency score';

    const teamStats = buildTeamStats(data, mode);
    const totalMembers = Object.keys(data).length;

    return (
        <div 
            ref={containerRef}
            className="relative bg-white/80 backdrop-blur-xl rounded-[32px] border border-white/40 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)]"
        >

            {/* ── Tooltip ──────────────────────────────────────────── */}
            <AnimatePresence>
                {hoveredCell && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        style={{ 
                            position: 'absolute', 
                            left: hoveredCell.x, 
                            top: hoveredCell.y, 
                            transform: 'translate(-50%, -120%)',
                            zIndex: 1000 
                        }}
                        className="pointer-events-none"
                    >
                        <div className="bg-[#1d1d1f] text-white p-4 rounded-2xl shadow-2xl border border-white/10 min-w-[200px]">
                            <div className="flex items-center gap-3 mb-2">
                                <UserAvatar
                                    name={hoveredCell.userName}
                                    avatarUrl={data[hoveredCell.userId]?.avatar_url}
                                    className="w-8 h-8 rounded-xl bg-white/10"
                                    textClassName="text-[10px] font-black text-white"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/50 truncate">{hoveredCell.userName}</p>
                                    <p className="text-xs font-bold">{format(hoveredCell.date, 'EEEE, MMM do')}</p>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/10">
                                <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{getMetricLabel(mode)}</span>
                                <span className="text-sm font-black text-[#0c64ef]">
                                    {hoveredCell.value === null ? 'No data' : hoveredCell.value}
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Header row ───────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <h3 className="text-2xl font-black text-[#1d1d1f] tracking-tight mb-1">Team Capacity</h3>
                    <p className="text-sm font-medium text-[#86868b] flex items-center gap-2">
                        <Users size={14} className="text-[#0c64ef]" />
                        Weekly workload overview and team utilization
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Mode switcher */}
                    <div className="flex p-1 bg-[#f5f5f7] rounded-2xl border border-[#e5e5ea]/50 shadow-inner">
                        {(['tasks', 'hours', 'urgency'] as Mode[]).map(m => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={cn(
                                    'px-4 py-2 text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-300 rounded-xl',
                                    mode === m 
                                        ? 'bg-white text-[#0c64ef] shadow-[0_2px_8px_rgba(0,0,0,0.08)] scale-[1.02]' 
                                        : 'text-[#86868b] hover:text-[#1d1d1f] hover:bg-white/50'
                                )}
                            >
                                {getMetricLabel(m)}
                            </button>
                        ))}
                    </div>

                    {/* Week navigation */}
                    <div className="flex items-center gap-1 bg-[#f5f5f7] rounded-2xl p-1 border border-[#e5e5ea]/50 shadow-inner">
                        <button
                            onClick={() => navigate(-1)}
                            disabled={navigating}
                            className="p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all disabled:opacity-40"
                        >
                            <ChevronLeft size={16} className="text-[#1d1d1f]" />
                        </button>
                        <span className="px-4 text-[10px] font-black text-[#1d1d1f] whitespace-nowrap min-w-[130px] text-center">
                            {navigating
                                ? <Loader2 size={12} className="animate-spin" />
                                : isCurrentWeek ? 'THIS WEEK' : `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d')}`.toUpperCase()
                            }
                        </span>
                        <button
                            onClick={() => navigate(+1)}
                            disabled={navigating}
                            className="p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all disabled:opacity-40"
                        >
                            <ChevronRight size={16} className="text-[#1d1d1f]" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Team summary pills ───────────────────────────────── */}
            {totalMembers > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    <SummaryPill
                        icon={<AlertTriangle size={14} />}
                        label="Overloaded"
                        value={teamStats.overloaded}
                        total={totalMembers}
                        color="text-[#e83f3f]"
                        bg="bg-[#fee2e2]"
                    />
                    <SummaryPill
                        icon={<TrendingUp size={14} />}
                        label="Busy"
                        value={teamStats.busy}
                        total={totalMembers}
                        color="text-[#ea580c]"
                        bg="bg-[#ffedd5]"
                    />
                    <SummaryPill
                        icon={<Users size={14} />}
                        label="Moderate"
                        value={teamStats.moderate}
                        total={totalMembers}
                        color="text-[#ca8a04]"
                        bg="bg-[#fef9c3]"
                    />
                    <SummaryPill
                        icon={<CheckCircle2 size={14} />}
                        label="Available"
                        value={teamStats.free}
                        total={totalMembers}
                        color="text-[#16a34a]"
                        bg="bg-[#dcfce7]"
                    />
                </div>
            )}

            {/* ── Utilization bars ─────────────────────────────────── */}
            {totalMembers > 0 && (
                <div className="mb-10 space-y-3 bg-white/40 backdrop-blur-sm rounded-[32px] p-8 border border-white/60 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
                    <div className="flex items-center justify-between mb-6 px-1">
                        <div>
                            <p className="text-[10px] font-black text-[#86868b] uppercase tracking-[0.25em] mb-1">
                                TEAM UTILIZATION
                            </p>
                            <p className="text-[11px] font-bold text-[#1d1d1f] opacity-60">
                                Current week status based on {getMetricLabel(mode).toLowerCase()}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.3)]" />
                            <div className="w-2 h-2 rounded-full bg-[#f59e0b] shadow-[0_0_8px_rgba(245,158,11,0.3)]" />
                            <div className="w-2 h-2 rounded-full bg-[#ef4444] shadow-[0_0_8px_rgba(239,68,68,0.3)]" />
                        </div>
                    </div>
                    {Object.entries(data).map(([uid, member]) => {
                        const total = getMemberWeekTotals(member, mode);
                        const level = getMemberPeakLevel(member, mode);
                        const colors = HEAT_COLORS[level];
                        const pct = Math.min((total / BAR_MAX[mode]) * 100, 100);
                        return (
                            <motion.div 
                                key={uid} 
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-4 bg-white/60 hover:bg-white p-3 rounded-[24px] transition-all duration-300 group/row border border-transparent hover:border-[#0c64ef]/10 hover:shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
                            >
                                <UserAvatar
                                    name={member.name}
                                    avatarUrl={member.avatar_url}
                                    className="w-12 h-12 rounded-[18px] bg-[#1d1d1f] shrink-0 shadow-sm group-hover/row:scale-105 transition-transform"
                                    textClassName="text-[10px] font-black text-white"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[13px] font-black text-[#1d1d1f] tracking-tight truncate">{member.name}</span>
                                        <div className="flex items-center gap-2">
                                            <span className={cn('text-[10px] font-black tabular-nums', colors.text)}>
                                                {total}{mode === 'hours' ? 'H' : mode === 'tasks' ? ' TASKS' : ' PTS'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="relative h-2.5 bg-[#e5e5ea]/50 rounded-full overflow-hidden">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${pct}%` }}
                                            transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1] }}
                                            className={cn('absolute inset-y-0 left-0 rounded-full', colors.bar)}
                                        />
                                        {/* Glow effect for high utilization */}
                                        {pct > 80 && (
                                            <motion.div 
                                                animate={{ opacity: [0.3, 0.6, 0.3] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                                className={cn('absolute inset-y-0 left-0 rounded-full blur-[4px] opacity-40', colors.bar)}
                                                style={{ width: `${pct}%` }}
                                            />
                                        )}
                                    </div>
                                </div>
                                <div className="hidden sm:flex flex-col items-end gap-1 shrink-0 px-2">
                                    <span className={cn(
                                        'text-[8px] font-black uppercase tracking-[0.15em] px-2.5 py-1 rounded-lg border shadow-sm transition-colors',
                                        colors.bg, colors.text, colors.border
                                    )}>
                                        {STATUS_LABEL[level]}
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* ── Heatmap grid ─────────────────────────────────────── */}
            <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full border-separate border-spacing-y-2">
                    <thead>
                        <tr className="border-b border-[#f5f5f7]">
                            <th className="text-left text-[10px] font-black text-[#86868b] uppercase tracking-[0.2em] pb-6 pl-4 w-48">Resource Allocation</th>
                            {days.map(d => (
                                <th key={d.toISOString()} className="text-center text-[10px] font-black text-[#86868b] uppercase tracking-wider pb-6 px-1">
                                    <div className="flex flex-col items-center">
                                        <span className={cn('mb-1 px-2 py-0.5 rounded-md transition-colors', isSameDay(d, new Date()) ? 'bg-[#0c64ef] text-white' : 'text-[#86868b]')}>
                                            {format(d, 'EEE').toUpperCase()}
                                        </span>
                                        <span className={cn('text-xs font-bold transition-colors', isSameDay(d, new Date()) ? 'text-[#0c64ef]' : 'text-[#1d1d1f]')}>
                                            {format(d, 'd')}
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.keys(data).length === 0 ? (
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
                                            <UserAvatar
                                                name={member.name}
                                                avatarUrl={member.avatar_url}
                                                className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1d1d1f] to-[#434343]"
                                                textClassName="text-[9px] font-black text-white"
                                            />
                                            <span className="text-xs font-bold text-[#1d1d1f] truncate max-w-[100px]">
                                                {member.name}
                                            </span>
                                        </div>
                                    </td>
                                    {days.map(d => {
                                        const dateKey  = format(d, 'yyyy-MM-dd');
                                        const dayData  = member.days[dateKey];
                                        const value    = dayData ? dayData[mode] : null;
                                        const level    = getHeatLevel(value, mode);
                                        const colors   = HEAT_COLORS[level];
                                        const isSelected = selectedCell && isSameDay(selectedCell.date, d) && selectedCell.userId === userId;
                                        const isToday  = isSameDay(d, new Date());

                                        return (
                                            <td key={dateKey} className="py-1 px-1">
                                                <motion.div
                                                    whileHover={{ scale: 1.1, y: -2, rotate: 1 }}
                                                    whileTap={{ scale: 0.9 }}
                                                    className={cn(
                                                        'w-full h-12 min-w-[44px] rounded-[14px] flex items-center justify-center transition-all duration-300 cursor-pointer border shadow-sm relative group/cell',
                                                        colors.bg, colors.text, colors.border,
                                                        isSelected ? 'ring-2 ring-offset-2 ring-[#0c64ef] border-[#0c64ef] z-10' : '',
                                                        isToday && !isSelected ? 'ring-2 ring-[#0c64ef]/20 border-[#0c64ef]/30' : ''
                                                    )}
                                                    onMouseMove={e => {
                                                        if (!containerRef.current) return;
                                                        const rect = containerRef.current.getBoundingClientRect();
                                                        setHoveredCell({ 
                                                            userId, 
                                                            userName: member.name, 
                                                            date: d, 
                                                            value, 
                                                            x: e.clientX - rect.left, 
                                                            y: e.clientY - rect.top 
                                                        });
                                                    }}
                                                    onMouseLeave={() => setHoveredCell(null)}
                                                    onClick={() => setSelectedCell({ userId, userName: member.name, date: d })}
                                                >
                                                    <span className="text-xs font-black tracking-tighter">
                                                        {value === null ? '·' : value}
                                                    </span>
                                                    {isToday && (
                                                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#0c64ef] rounded-full border-2 border-white shadow-sm" />
                                                    )}
                                                    <div className="absolute inset-0 bg-white opacity-0 group-hover/cell:opacity-20 transition-opacity rounded-[14px]" />
                                                </motion.div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* ── Drill-down detail panel ───────────────────────────── */}
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
                                <UserAvatar
                                    name={selectedCell.userName}
                                    avatarUrl={data[selectedCell.userId]?.avatar_url}
                                    className="w-12 h-12 rounded-[20px] bg-[#0c64ef] shadow-lg shadow-[#0c64ef]/20"
                                    textClassName="text-white text-lg font-black"
                                />
                                <div>
                                    <h4 className="text-xl font-black text-[#1d1d1f] tracking-tight">
                                        Work Details — {selectedCell.userName}
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
                                            <div className="h-4 w-20 bg-[#f5f5f7] rounded-full" />
                                            <div className="h-4 w-12 bg-[#f5f5f7] rounded-full" />
                                        </div>
                                        <div className="h-5 w-3/4 bg-[#f5f5f7] rounded-lg mb-2" />
                                        <div className="h-4 w-full bg-[#f5f5f7] rounded-lg mb-6" />
                                        <div className="pt-4 border-t border-[#f5f5f7] flex justify-between">
                                            <div className="h-3 w-16 bg-[#f5f5f7] rounded-full" />
                                            <div className="h-5 w-10 bg-[#f5f5f7] rounded-full" />
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
                                <p className="text-xs font-medium text-[#86868b]">
                                    {selectedCell.userName} has no logged work for this day.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {details.map((detail, idx) => (
                                    <div key={idx} className="group/card bg-white p-6 rounded-[28px] border border-[#e5e5ea] hover:border-[#0c64ef] hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] transition-all duration-300">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-[10px] font-black text-[#0c64ef] uppercase tracking-[0.2em] bg-[#0c64ef]/5 px-3 py-1 rounded-full">
                                                Task Record
                                            </span>
                                            <span className="text-[10px] font-bold text-[#86868b]">
                                                {format(new Date(detail.created_at), 'h:mm a')}
                                            </span>
                                        </div>
                                        <h5 className="text-[15px] font-black text-[#1d1d1f] tracking-tight mb-2 line-clamp-1 group-hover/card:text-[#0c64ef] transition-colors">
                                            {detail.task_name}
                                        </h5>
                                        <p className="text-sm font-medium text-[#86868b] mb-6 line-clamp-2 leading-relaxed">
                                            {detail.subtask_name}
                                        </p>
                                        <div className="flex items-center justify-between pt-4 border-t border-[#f5f5f7]">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-[#34c759] shadow-[0_0_8px_rgba(52,199,89,0.4)]" />
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

            {/* ── Legend ───────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-center justify-between mt-10 gap-4 p-5 bg-white/40 backdrop-blur-sm rounded-2xl border border-white/60 shadow-sm">
                <div className="flex items-center gap-8">
                    <span className="text-[10px] font-black text-[#86868b] uppercase tracking-[0.2em]">Scale Guide</span>
                    <div className="flex items-center gap-4">
                        {(['free', 'moderate', 'busy', 'overloaded'] as const).map((level, i) => (
                            <div key={level} className="flex items-center gap-2 group/legend">
                                <div className={cn('w-4 h-4 rounded-[6px] shadow-sm transition-transform group-hover/legend:scale-110', HEAT_COLORS[level].bg, HEAT_COLORS[level].border, 'border')} />
                                <span className="text-[10px] font-bold text-[#1d1d1f] opacity-70 group-hover/legend:opacity-100 transition-opacity whitespace-nowrap">
                                    {['Optimal', 'Moderate', 'Busy', 'Critical'][i]}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] font-bold text-[#0c64ef] bg-[#0c64ef]/5 px-4 py-2 rounded-full border border-[#0c64ef]/10">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#0c64ef] animate-pulse" />
                    Interative View: Click any cell for drill-down
                </div>
            </div>
        </div>
    );
}

// ─── Summary pill sub-component ───────────────────────────────────────────────
function SummaryPill({
    icon, label, value, total, color, bg,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    total: number;
    color: string;
    bg: string;
}) {
    return (
        <motion.div 
            whileHover={{ y: -4, shadow: '0 12px 24px rgba(0,0,0,0.05)' }}
            className={cn('rounded-[24px] p-5 flex items-center gap-4 border transition-all duration-500', bg, 'border-white/40 shadow-[0_4px_12px_rgba(0,0,0,0.02)]')}
        >
            <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center bg-white shadow-sm border border-black/5', color)}>
                {React.cloneElement(icon as React.ReactElement, { size: 20, strokeWidth: 2.5 })}
            </div>
            <div className="min-w-0">
                <p className={cn('text-2xl font-black leading-tight tracking-tighter', color)}>{value}</p>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#86868b] mt-0.5 truncate opacity-70">
                    {label} <span className="text-[#1d1d1f]/30">/ {total}</span>
                </p>
            </div>
        </motion.div>
    );
}
