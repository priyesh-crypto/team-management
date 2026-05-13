"use client";

import React, { useState, useMemo } from 'react';
import { 
    format, 
    startOfMonth, 
    endOfMonth, 
    startOfWeek, 
    endOfWeek, 
    eachDayOfInterval, 
    isSameMonth, 
    isSameDay, 
    addMonths, 
    subMonths,
    isToday,
    parseISO,
    addDays
} from 'date-fns';
import { 
    ChevronLeft, 
    ChevronRight, 
    Calendar as CalendarIcon, 
    Sparkles, 
    Users, 
    Clock, 
    AlertTriangle,
    CheckCircle2,
    Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Task, Profile } from '@/app/actions/actions';

interface Props {
    tasks: Task[];
    employees: Profile[];
    onTaskClick: (task: Task) => void;
    onDateClick: (date: Date) => void;
    onUpdateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
}

export function SmartCalendar({ tasks, employees, onTaskClick, onDateClick, onUpdateTask }: Props) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    // Calendar Generation
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    // AI Logic: Calculate Capacity per Day
    const dayStats = useMemo(() => {
        const stats: Record<string, { count: number; load: number }> = {};
        calendarDays.forEach(day => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const activeTasks = tasks.filter(t => {
                const start = t.start_date ? parseISO(t.start_date) : null;
                const end = t.deadline ? parseISO(t.deadline) : null;
                if (!start || !end) return false;
                return day >= start && day <= end && t.status !== 'Completed';
            });
            
            // Assume 1 task per employee per day is 100% load
            const load = (activeTasks.length / Math.max(employees.length, 1)) * 100;
            stats[dayKey] = { count: activeTasks.length, load };
        });
        return stats;
    }, [tasks, employees, calendarDays]);

    // AI Recommendation: Find the "Best Slot" for the selected task
    const aiRecommendations = useMemo(() => {
        if (!selectedTask) return null;
        
        // Look ahead 14 days from today
        const lookAhead = eachDayOfInterval({ 
            start: new Date(), 
            end: addDays(new Date(), 14) 
        });

        const recommendations = lookAhead
            .map(day => ({
                day,
                load: dayStats[format(day, 'yyyy-MM-dd')]?.load || 0
            }))
            .sort((a, b) => a.load - b.load) // Least loaded first
            .slice(0, 3);

        return recommendations;
    }, [selectedTask, dayStats]);

    const getLoadColor = (load: number) => {
        if (load > 80) return 'bg-red-50 text-red-600 border-red-100';
        if (load > 40) return 'bg-amber-50 text-amber-600 border-amber-100';
        return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    };

    return (
        <div className="flex h-[calc(100vh-12rem)] gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Main Calendar Grid */}
            <div className="flex-1 bg-white rounded-[32px] border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#0051e6] text-white flex items-center justify-center shadow-lg shadow-[#0051e6]/20">
                            <CalendarIcon size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-[#1d1d1f] tracking-tight">
                                {format(currentMonth, 'MMMM yyyy')}
                            </h2>
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#34c759]" />
                                <span className="text-[10px] font-black text-[#86868b] uppercase tracking-widest">Team Capacity: {Math.round(Object.values(dayStats).reduce((acc, curr) => acc + curr.load, 0) / Object.values(dayStats).length || 0)}% Avg</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-[#f5f5f7] p-1.5 rounded-2xl">
                        <button 
                            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                            className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-600"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button 
                            onClick={() => setCurrentMonth(new Date())}
                            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#1d1d1f] hover:bg-white hover:shadow-sm rounded-xl transition-all"
                        >
                            Today
                        </button>
                        <button 
                            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                            className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-600"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                {/* Grid */}
                <div className="flex-1 overflow-auto custom-scrollbar">
                    <div className="grid grid-cols-7 border-b border-slate-100">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                            <div key={day} className="py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 h-full min-h-[600px]">
                        {calendarDays.map((day, idx) => {
                            const dayKey = format(day, 'yyyy-MM-dd');
                            const stats = dayStats[dayKey];
                            const dayTasks = tasks.filter(t => t.deadline && isSameDay(parseISO(t.deadline), day));
                            const isSelected = aiRecommendations?.some(r => isSameDay(r.day, day));

                            return (
                                <div 
                                    key={dayKey}
                                    onClick={() => onDateClick(day)}
                                    className={`min-h-[120px] p-3 border-r border-b border-slate-50 transition-all cursor-pointer group hover:bg-slate-50/50 ${!isSameMonth(day, monthStart) ? 'bg-slate-50/30' : ''} ${isSelected ? 'ring-2 ring-inset ring-[#0051e6] bg-[#0051e6]/5' : ''}`}
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className={`text-xs font-black ${isToday(day) ? 'w-7 h-7 bg-[#0051e6] text-white rounded-lg flex items-center justify-center shadow-md' : isSameMonth(day, monthStart) ? 'text-slate-900' : 'text-slate-300'}`}>
                                            {format(day, 'd')}
                                        </span>
                                        {stats.load > 0 && (
                                            <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border ${getLoadColor(stats.load)}`}>
                                                {Math.round(stats.load)}% LOAD
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1.5">
                                        {dayTasks.slice(0, 3).map(task => (
                                            <motion.div
                                                key={task.id}
                                                layoutId={task.id}
                                                onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                                                className={`p-2 rounded-xl text-[10px] font-bold border truncate shadow-sm transition-transform hover:scale-102 ${
                                                    task.priority === 'Urgent' ? 'bg-red-50 text-red-700 border-red-100' :
                                                    task.priority === 'High' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                                    'bg-blue-50 text-blue-700 border-blue-100'
                                                }`}
                                            >
                                                {task.name}
                                            </motion.div>
                                        ))}
                                        {dayTasks.length > 3 && (
                                            <div className="text-[9px] font-black text-slate-400 pl-2 uppercase tracking-widest">
                                                + {dayTasks.length - 3} more
                                            </div>
                                        )}
                                    </div>

                                    {/* Quick Add Button */}
                                    <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
                                        <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 text-slate-400 flex items-center justify-center hover:text-[#0051e6] hover:border-[#0051e6] transition-all">
                                            <Plus size={14} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* AI Smart Panel */}
            <div className="w-80 space-y-6">
                {/* Pending / Unscheduled Tasks */}
                <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-xl shadow-slate-200/50">
                    <div className="flex items-center gap-2 mb-6">
                        <Sparkles size={18} className="text-[#0051e6]" />
                        <h3 className="text-xs font-black text-[#1d1d1f] uppercase tracking-widest">Smart Queue</h3>
                    </div>
                    
                    <div className="space-y-3 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                        {tasks.filter(t => t.status === 'To Do' && !t.deadline).length === 0 ? (
                            <div className="text-center py-8">
                                <div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-3">
                                    <CheckCircle2 size={20} />
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Queue Clear</p>
                            </div>
                        ) : (
                            tasks.filter(t => t.status === 'To Do' && !t.deadline).map(task => (
                                <div 
                                    key={task.id}
                                    onClick={() => setSelectedTask(task)}
                                    className={`p-4 rounded-[24px] border transition-all cursor-pointer group ${selectedTask?.id === task.id ? 'bg-[#0051e6] border-[#0051e6] shadow-lg shadow-[#0051e6]/20' : 'bg-slate-50 border-transparent hover:border-slate-200'}`}
                                >
                                    <h4 className={`text-[11px] font-bold mb-1 ${selectedTask?.id === task.id ? 'text-white' : 'text-slate-900'}`}>{task.name}</h4>
                                    <div className="flex items-center gap-3">
                                        <div className={`flex items-center gap-1 text-[9px] font-black uppercase ${selectedTask?.id === task.id ? 'text-white/60' : 'text-slate-400'}`}>
                                            <Users size={10} />
                                            {employees.find(e => e.id === task.employee_id)?.name || 'Unassigned'}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* AI Recommendation Card */}
                <AnimatePresence mode="wait">
                    {selectedTask && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-gradient-to-br from-[#1d1d1f] to-[#2d2d2f] rounded-[32px] p-6 text-white shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-10">
                                <Sparkles size={80} />
                            </div>
                            
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-6 text-white/50">Optimal Scheduling</h3>
                            
                            <div className="space-y-4 relative z-10">
                                {aiRecommendations?.map((rec, i) => (
                                    <button
                                        key={i}
                                        onClick={() => onUpdateTask(selectedTask.id, { 
                                            start_date: format(rec.day, 'yyyy-MM-dd'),
                                            deadline: format(rec.day, 'yyyy-MM-dd') 
                                        })}
                                        className="w-full bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl p-4 transition-all text-left group"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-bold">{format(rec.day, 'EEEE, MMM do')}</span>
                                            <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${rec.load < 30 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                {Math.round(rec.load)}% LOAD
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-white/60 font-medium">Predicted high velocity slot based on team capacity.</p>
                                    </button>
                                ))}
                            </div>

                            <button 
                                onClick={() => setSelectedTask(null)}
                                className="w-full mt-6 py-4 rounded-2xl bg-white text-black text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                            >
                                Cancel Selection
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Legend */}
                <div className="bg-white rounded-[32px] border border-slate-200 p-6 shadow-xl shadow-slate-200/50">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Color Guide</h3>
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-lg bg-red-50 border border-red-100" />
                            <span className="text-[10px] font-bold text-slate-600">Overloaded (&gt;80%)</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-lg bg-amber-50 border border-amber-100" />
                            <span className="text-[10px] font-bold text-slate-600">Moderate (40-80%)</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-lg bg-emerald-50 border border-emerald-100" />
                            <span className="text-[10px] font-bold text-slate-600">Available (&lt;40%)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
