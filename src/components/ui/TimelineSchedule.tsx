"use client";

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Task, Profile, Priority, Status } from '@/app/actions/actions';
import { Card, Button, Badge } from '@/components/ui/components';
import { 
    ChevronLeft, 
    ChevronRight, 
    Calendar as CalendarIcon, 
    Filter, 
    Plus,
    X,
    CheckCircle2,
    Users,
    Clock,
    Search,
    ArrowRight
} from 'lucide-react';

interface TimelineScheduleProps {
    tasks: Task[];
    employees: Profile[];
    onTaskClick: (task: Task) => void;
    onEmployeeClick: (employee: Profile) => void;
    refreshData: () => void;
    searchFilter?: string;
}

export default function TimelineSchedule({ tasks, employees, onTaskClick, onEmployeeClick, refreshData, searchFilter }: TimelineScheduleProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [searchQuery, setSearchQuery] = useState('');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [now, setNow] = useState(new Date());
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const timer = setInterval(() => setNow(new Date()), 1000); // Update every second
        return () => clearInterval(timer);
    }, []);
    
    useEffect(() => {
        if (searchFilter !== undefined) {
            setSearchQuery(searchFilter);
        }
    }, [searchFilter]);

    // Generate days for the timeline
    const timelineData = useMemo(() => {
        const days = [];
        const start = new Date(currentDate);
        
        if (viewMode === 'week') {
            // Center currentDate by showing 3 days before and 3 days after
            start.setDate(currentDate.getDate() - 3);
        } else {
            start.setDate(1);
        }

        const numDays = viewMode === 'week' ? 7 : 30;
        
        for (let i = 0; i < numDays; i++) {
            const day = new Date(start);
            day.setDate(start.getDate() + i);
            days.push(day);
        }
        
        return {
            days,
            startDate: days[0],
            endDate: days[days.length - 1]
        };
    }, [currentDate, viewMode]);

    const navigate = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        if (viewMode === 'week') {
            newDate.setDate(currentDate.getDate() + (direction === 'next' ? 7 : -7));
        } else {
            newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        }
        setCurrentDate(newDate);
    };

    // Auto-scroll to current date on mount and view changes
    useEffect(() => {
        if (scrollContainerRef.current) {
            // Find the today indicator or the current date column
            const todayCol = scrollContainerRef.current.querySelector('.today-column');
            if (todayCol) {
                todayCol.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        }
    }, [timelineData, viewMode]);

    const isToday = (date: Date) => {
        return date.toDateString() === now.toDateString();
    };

    const COLUMN_WIDTH = 112; // w-28 = 7rem = 112px at standard browser settings

    const getTaskStyle = (task: Task) => {
        const start = new Date(task.start_date);
        const end = new Date(task.deadline);
        
        // Find indices in our day array
        const startIndex = timelineData.days.findIndex(d => d.toDateString() === start.toDateString());
        const endIndex = timelineData.days.findIndex(d => d.toDateString() === end.toDateString());
        
        // Handle tasks that start before or end after the current view
        let effectiveStart = startIndex;
        let effectiveEnd = endIndex;
        
        if (startIndex === -1) {
            if (start < timelineData.startDate && end >= timelineData.startDate) {
                effectiveStart = 0;
            } else {
                return null;
            }
        }
        
        if (endIndex === -1) {
            if (end > timelineData.endDate && start <= timelineData.endDate) {
                effectiveEnd = timelineData.days.length - 1;
            } else {
                return null;
            }
        }

        const dayWidth = 100 / timelineData.days.length;
        const left = effectiveStart * dayWidth;
        const width = (effectiveEnd - effectiveStart + 1) * dayWidth;

        return {
            left: `${left}%`,
            width: `${width}%`
        };
    };

    return (
        <div className="flex flex-col h-full bg-slate-50/50 p-6 rounded-[32px] gap-6 overflow-y-auto custom-scrollbar">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm transition-all duration-300">
                <div className="flex items-center gap-8">
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Timeline</h2>
                        <div className="flex items-center gap-4">
                            <p className="text-slate-400 font-bold text-[9px] uppercase tracking-widest">
                                {mounted ? currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '...'}
                            </p>
                            <div className="h-3 w-px bg-slate-100" />
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{tasks.length} Total</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#34c759]" />
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{tasks.filter(t => t.status === 'Completed').length} Done</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                        <button 
                            onClick={() => setViewMode('week')}
                            className={`px-5 py-1.5 rounded-lg text-[9px] font-bold tracking-widest transition-all duration-300 ${viewMode === 'week' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            WEEK
                        </button>
                        <button 
                            onClick={() => setViewMode('month')}
                            className={`px-5 py-1.5 rounded-lg text-[9px] font-bold tracking-widest transition-all duration-300 ${viewMode === 'month' ? 'bg-white text-slate-900 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            MONTH
                        </button>
                    </div>
                </div>
 
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" size={13} />
                        <input 
                            type="text" 
                            placeholder="Find member or task..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 pl-10 pr-4 rounded-xl bg-slate-50/50 border border-slate-100 text-[11px] font-medium outline-none focus:bg-white focus:border-[#0071e3]/30 transition-all w-full sm:w-48 lg:w-64"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setCurrentDate(new Date())}
                            className="h-10 px-4 rounded-xl bg-white border border-slate-100 hover:border-slate-300 transition-all text-[9px] font-bold uppercase tracking-widest text-slate-500"
                        >
                            Today
                        </button>
                        <button onClick={() => navigate('prev')} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-slate-100 hover:border-slate-300 transition-all text-slate-500">
                            <ChevronLeft size={16} />
                        </button>
                        <button onClick={() => navigate('next')} className="h-10 w-10 flex items-center justify-center rounded-xl bg-white border border-slate-100 hover:border-slate-300 transition-all text-slate-500">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
 
            {/* Timeline Viewport */}
            <div 
                className="flex-1 min-h-[400px] bg-white rounded-[24px] shadow-sm border border-slate-100 overflow-hidden flex flex-col relative"
                style={{ 
                    '--sticky-width': '180px',
                    '--col-width': '128px'
                } as any}
            >
                <div 
                    ref={scrollContainerRef}
                    className="flex-1 overflow-x-auto custom-scrollbar-subtle flex flex-col"
                >
                    {/* Horizontal Date Header */}
                    <div className="flex bg-white sticky top-0 z-30 border-b border-slate-50 min-w-max">
                        <div className="w-[var(--sticky-width)] border-r border-slate-50 shrink-0 p-5 sticky left-0 bg-white z-40 flex items-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Team Availability</span>
                        </div>
                        <div className="flex">
                            {timelineData.days.map((date, i) => {
                                const active = isToday(date);
                                return (
                                    <div 
                                        key={i} 
                                        className={`w-[var(--col-width)] py-4 text-center border-l first:border-l-0 border-slate-50 transition-all relative ${active ? 'bg-slate-50/50 today-column' : ''}`}
                                    >
                                        <p className={`text-[8px] font-bold uppercase tracking-widest mb-1 ${active ? 'text-[#0071e3]' : 'text-slate-400'}`}>
                                            {mounted ? date.toLocaleDateString('en-US', { weekday: 'short' }) : '...'}
                                        </p>
                                        <div className="relative inline-block">
                                            <p className={`text-sm font-bold ${active ? 'text-white' : 'text-slate-900'}`}>
                                                {date.getDate()}
                                            </p>
                                            {active && (
                                                <div className="absolute inset-x-[-6px] inset-y-[-2px] bg-[#0071e3] rounded-md -z-10 shadow-sm" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
 
                    {/* Resource Rows */}
                    <div className="flex-1 min-w-max relative bg-white">
                        <div className="flex flex-col min-h-full">
                            {employees.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())).map((emp, empIdx) => (
                                <div key={emp.id} className="flex min-h-[90px] border-b border-slate-50 group transition-colors hover:bg-slate-50/30">
                                    {/* Sticky Profile Column */}
                                    <div className="w-[var(--sticky-width)] border-r border-slate-50 shrink-0 p-5 flex items-center gap-4 sticky left-0 bg-white group-hover:bg-slate-50/30 z-20 transition-all">
                                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-[11px] font-bold text-slate-600">
                                            {emp.name.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[12px] font-bold text-slate-800 truncate leading-tight mb-0.5">{emp.name}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                                {tasks.filter(t => t.employee_id === emp.id).length} active
                                            </p>
                                        </div>
                                    </div>
 
                                    {/* Task Container */}
                                    <div className="flex-1 relative flex items-center">
                                        <div className="absolute inset-0 flex pointer-events-none">
                                            {timelineData.days.map((date, i) => (
                                                <div key={i} className={`w-[var(--col-width)] border-l border-slate-50 first:border-l-0 ${isToday(date) ? 'bg-slate-50/20' : ''}`} />
                                            ))}
                                        </div>
 
                                        {/* Render Tasks for this employee */}
                                        {(() => {
                                            const empTasks = tasks
                                                .filter(t => t.employee_id === emp.id)
                                                .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
                                            
                                            const lanes: string[][] = [];
                                            
                                            const taskElements = empTasks.map(task => {
                                                const start = new Date(task.start_date);
                                                const end = new Date(task.deadline);
                                                
                                                const startIndex = timelineData.days.findIndex(d => d.toDateString() === start.toDateString());
                                                const endIndex = timelineData.days.findIndex(d => d.toDateString() === end.toDateString());
                                                
                                                if (startIndex === -1 && endIndex === -1) {
                                                    if (!(start < timelineData.startDate && end > timelineData.endDate)) return null;
                                                }
 
                                                const effectiveStart = startIndex === -1 ? 0 : startIndex;
                                                const effectiveEnd = endIndex === -1 ? timelineData.days.length - 1 : endIndex;
                                                
                                                const colWidth = 128; // Matching col-width var
                                                const left = effectiveStart * colWidth;
                                                const width = (effectiveEnd - effectiveStart + 1) * colWidth;
 
                                                let laneIndex = 0;
                                                while (laneIndex < lanes.length) {
                                                    const lastEndDateInLane = new Date(lanes[laneIndex][lanes[laneIndex].length - 1]);
                                                    if (start.getTime() > lastEndDateInLane.getTime() + 3600000) break;
                                                    laneIndex++;
                                                }
                                                
                                                if (laneIndex === lanes.length) lanes.push([task.deadline]);
                                                else lanes[laneIndex].push(task.deadline);
 
                                                const isCompleted = task.status === 'Completed';
                                                
                                                const getBaseClasses = () => {
                                                    if (isCompleted) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
                                                    switch(task.priority) {
                                                        case 'Urgent': return 'bg-rose-50 text-rose-700 border-rose-100';
                                                        case 'High': return 'bg-orange-50 text-orange-700 border-orange-100';
                                                        case 'Medium': return 'bg-blue-50 text-blue-700 border-blue-100';
                                                        default: return 'bg-slate-50 text-slate-700 border-slate-100';
                                                    }
                                                };
 
                                                const getAccentClasses = () => {
                                                    if (isCompleted) return 'bg-emerald-500';
                                                    switch(task.priority) {
                                                        case 'Urgent': return 'bg-rose-500';
                                                        case 'High': return 'bg-orange-500';
                                                        case 'Medium': return 'bg-blue-500';
                                                        default: return 'bg-slate-400';
                                                    }
                                                };
 
                                                return (
                                                    <div
                                                        key={task.id}
                                                        onClick={() => onTaskClick(task)}
                                                        className={`absolute h-8 rounded-lg border px-3 flex items-center gap-2 transition-all duration-300 hover:z-10 hover:shadow-md cursor-pointer group/task ${getBaseClasses()}`}
                                                        style={{
                                                            left: `${left + 6}px`,
                                                            width: `${width - 12}px`,
                                                            top: `${laneIndex * 40 + 8}px`,
                                                            zIndex: task.priority === 'Urgent' ? 5 : 1
                                                        }}
                                                    >
                                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getAccentClasses()}`} />
                                                        <span className="text-[10px] font-bold truncate overflow-hidden">{task.name}</span>
                                                    </div>
                                                );
                                            });
 
                                            return (
                                                <div className="relative w-full h-full" style={{ minHeight: `${Math.max(1, lanes.length) * 40 + 16}px` }}>
                                                    {taskElements}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ))}
                        </div>
 
                        {/* GLOBAL REAL-TIME "NOW" INDICATOR */}
                        {(() => {
                            const todayIndex = timelineData.days.findIndex(d => isToday(d));
                            if (todayIndex === -1) return null;
                            
                            const dayProgress = (now.getHours() * 60 + now.getMinutes()) / 1440;
                            
                            return (
                                <div 
                                    className="absolute inset-y-0 w-px bg-rose-500 z-[50] pointer-events-none"
                                    style={{ 
                                        left: `calc(var(--sticky-width) + (${todayIndex} * var(--col-width)) + (${dayProgress} * var(--col-width)))` 
                                    }}
                                >
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-rose-500 border border-white shadow-sm" />
                                    <div className="absolute top-0 left-4 bg-rose-500 text-white text-[8px] font-bold px-2 py-0.5 rounded shadow-sm whitespace-nowrap tracking-widest uppercase">
                                        {mounted ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>
 
        </div>
    );
}
