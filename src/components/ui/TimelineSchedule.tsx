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
    Search
} from 'lucide-react';

interface TimelineScheduleProps {
    tasks: Task[];
    employees: Profile[];
    onTaskClick: (task: Task) => void;
    refreshData: () => void;
}

export default function TimelineSchedule({ tasks, employees, onTaskClick, refreshData }: TimelineScheduleProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
    const [searchQuery, setSearchQuery] = useState('');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000); // Update every second
        return () => clearInterval(timer);
    }, []);

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
        <div className="flex flex-col h-full bg-[#f5f5f7] p-4 lg:p-6 rounded-[40px] gap-6 overflow-y-auto custom-scrollbar">
            {/* Header Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 backdrop-blur-xl p-4 lg:p-6 rounded-3xl border border-white/40 shadow-sm transition-all duration-300">
                <div className="flex items-center gap-4 lg:gap-8">
                    <div>
                        <h2 className="text-xl lg:text-2xl font-black text-[#1d1d1f] tracking-tight">Project Timeline</h2>
                        <div className="flex items-center gap-4 mt-1">
                            <p className="text-[#86868b] font-bold text-[10px] lg:text-[11px] uppercase tracking-[0.2em]">
                                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </p>
                            <div className="h-4 w-px bg-[#e5e5ea]" />
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#1d1d1f]" />
                                    <span className="text-[10px] font-black text-[#1d1d1f]">{tasks.length} Total</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#34c759]" />
                                    <span className="text-[10px] font-black text-[#34c759]">{tasks.filter(t => t.status === 'Completed').length} Done</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#ff3b30]" />
                                    <span className="text-[10px] font-black text-[#ff3b30]">{tasks.filter(t => t.priority === 'Urgent').length} Urgent</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex bg-[#e5e5ea]/50 p-1 rounded-2xl">
                        <button 
                            onClick={() => setViewMode('week')}
                            className={`px-4 lg:px-6 py-2 rounded-xl text-[10px] font-black transition-all duration-300 ${viewMode === 'week' ? 'bg-[#1d1d1f] text-white shadow-lg scale-105' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                        >
                            WEEK
                        </button>
                        <button 
                            onClick={() => setViewMode('month')}
                            className={`px-4 lg:px-6 py-2 rounded-xl text-[10px] font-black transition-all duration-300 ${viewMode === 'month' ? 'bg-[#1d1d1f] text-white shadow-lg scale-105' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                        >
                            MONTH
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b]" size={14} />
                        <input 
                            type="text" 
                            placeholder="Filter timeline..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-10 pl-10 pr-4 rounded-2xl bg-white/60 border-none text-[11px] font-bold outline-none ring-1 ring-[#e5e5ea] focus:ring-2 focus:ring-[#0071e3] transition-all w-full sm:w-48 lg:w-64"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setCurrentDate(new Date())}
                            className="h-10 px-4 rounded-2xl bg-white border border-[#e5e5ea] hover:border-[#0071e3] hover:text-[#0071e3] transition-all text-[10px] font-black uppercase tracking-widest"
                        >
                            Today
                        </button>
                        <button onClick={() => navigate('prev')} className="h-10 w-10 flex items-center justify-center rounded-2xl bg-white border border-[#e5e5ea] hover:border-[#1d1d1f] transition-all text-[#1d1d1f]">
                            <ChevronLeft size={18} />
                        </button>
                        <button onClick={() => navigate('next')} className="h-10 w-10 flex items-center justify-center rounded-2xl bg-white border border-[#e5e5ea] hover:border-[#1d1d1f] transition-all text-[#1d1d1f]">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Timeline Viewport */}
            <div 
                className="flex-shrink-0 min-h-[500px] h-[600px] bg-white rounded-[40px] shadow-sm border border-[#eceef0] overflow-hidden flex flex-col relative group"
                style={{ 
                    '--sticky-width': '160px',
                    '--col-width': '112px'
                } as any}
            >
                <div 
                    ref={scrollContainerRef}
                    className="flex-1 overflow-x-auto custom-scrollbar flex flex-col lg:[--sticky-width:192px] lg:[--col-width:128px]"
                >
                    {/* Horizontal Date Header */}
                    <div className="flex bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-[#f5f5f7] min-w-max">
                        <div className="w-[var(--sticky-width)] border-r border-[#f5f5f7] shrink-0 p-4 sticky left-0 bg-white z-40 flex items-center">
                            <span className="text-[10px] font-black text-[#86868b] uppercase tracking-[0.2em]">Team Members</span>
                        </div>
                        <div className="flex">
                            {timelineData.days.map((date, i) => {
                                const active = isToday(date);
                                return (
                                    <div 
                                        key={i} 
                                        className={`w-28 lg:w-32 py-3 lg:py-4 text-center border-l first:border-l-0 border-[#f5f5f7] transition-all relative ${active ? 'bg-[#0071e3]/5 today-column' : ''}`}
                                    >
                                        {active && (
                                            <div className="absolute top-0 left-0 right-0 h-1 bg-[#0071e3] shadow-[0_0_10px_rgba(0,113,227,0.5)]" />
                                        )}
                                        <p className={`text-[9px] font-black uppercase tracking-widest mb-0.5 ${active ? 'text-[#0071e3] scale-110' : 'text-[#86868b]'}`}>
                                            {date.toLocaleDateString('en-US', { weekday: 'short' })}
                                        </p>
                                        <div className="relative inline-block">
                                            <p className={`text-base lg:text-lg font-black relative z-10 ${active ? 'text-white' : 'text-[#1d1d1f]'}`}>
                                                {date.getDate()}
                                            </p>
                                            {active && (
                                                <div className="absolute inset-0 -m-1 bg-[#0071e3] rounded-lg shadow-lg rotate-3" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Resource Rows */}
                    <div className="flex-1 min-w-max relative">
                        <div className="flex flex-col min-h-full">
                            {employees.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())).map((emp, empIdx) => (
                                <div key={emp.id} className="flex min-h-[100px] border-b border-[#f5f5f7] group/row transition-colors hover:bg-[#fbfbfd]">
                                    {/* Sticky Profile Column */}
                                    <div className="w-[var(--sticky-width)] border-r border-[#f5f5f7] shrink-0 p-4 flex items-center gap-3 sticky left-0 bg-white/95 backdrop-blur-sm z-20 transition-all group-hover/row:bg-white">
                                        <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center text-[11px] font-black group-hover:border-[#0071e3] transition-all duration-300">
                                            {emp.name.charAt(0)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] lg:text-[12px] font-black text-[#1d1d1f] truncate leading-tight mb-0.5">{emp.name}</p>
                                            <p className="text-[8px] font-bold text-[#86868b] uppercase tracking-widest">
                                                {tasks.filter(t => t.employee_id === emp.id).length} Active
                                            </p>
                                        </div>
                                    </div>

                                    {/* Task Container */}
                                    <div className="flex-1 relative flex items-center">
                                        <div className="absolute inset-0 flex pointer-events-none">
                                            {timelineData.days.map((date, i) => (
                                                <div key={i} className={`w-28 lg:w-32 border-l border-[#f5f5f7] first:border-l-0 relative ${isToday(date) ? 'bg-[#0071e3]/[0.02]' : ''}`} />
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
                                                
                                                const colWidth = 112; 
                                                const left = effectiveStart * colWidth;
                                                const width = (effectiveEnd - effectiveStart + 1) * colWidth;

                                                let laneIndex = 0;
                                                while (laneIndex < lanes.length) {
                                                    const lastEndDateInLane = new Date(lanes[laneIndex][lanes[laneIndex].length - 1]);
                                                    // Add a small buffer (1 hour) to prevent same-day overlap issues
                                                    if (start.getTime() > lastEndDateInLane.getTime() + 3600000) break;
                                                    laneIndex++;
                                                }
                                                
                                                if (laneIndex === lanes.length) lanes.push([task.deadline]);
                                                else lanes[laneIndex].push(task.deadline);

                                                const isCompleted = task.status === 'Completed';
                                                
                                                const getBaseClasses = () => {
                                                    if (isCompleted) return 'bg-[#34c759]/10 border-[#34c759]/20 text-[#1d1d1f]';
                                                    switch(task.priority) {
                                                        case 'Urgent': return 'bg-[#ff3b30]/10 border-[#ff3b30]/20 text-[#1d1d1f]';
                                                        case 'High': return 'bg-[#ff9500]/10 border-[#ff9500]/20 text-[#1d1d1f]';
                                                        case 'Medium': return 'bg-[#0071e3]/10 border-[#0071e3]/20 text-[#1d1d1f]';
                                                        default: return 'bg-[#5856d6]/10 border-[#5856d6]/20 text-[#1d1d1f]';
                                                    }
                                                };

                                                const getAccentClasses = () => {
                                                    if (isCompleted) return 'bg-[#34c759]';
                                                    switch(task.priority) {
                                                        case 'Urgent': return 'bg-[#ff3b30]';
                                                        case 'High': return 'bg-[#ff9500]';
                                                        case 'Medium': return 'bg-[#0071e3]';
                                                        default: return 'bg-[#5856d6]';
                                                    }
                                                };

                                                return (
                                                    <div
                                                        key={task.id}
                                                        onClick={() => onTaskClick(task)}
                                                        className={`absolute h-9 rounded-xl border px-3 flex items-center gap-2 transition-all duration-300 hover:z-10 hover:shadow-xl hover:scale-[1.01] cursor-pointer group/task ${getBaseClasses()}`}
                                                        style={{
                                                            left: `${left + 4}px`,
                                                            width: `${width - 8}px`,
                                                            top: `${laneIndex * 44 + 8}px`,
                                                            zIndex: task.priority === 'Urgent' ? 5 : 1
                                                        }}
                                                    >
                                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${getAccentClasses()}`} />
                                                        <span className="text-[10px] font-black truncate">{task.name}</span>
                                                    </div>
                                                );
                                            });

                                            return (
                                                <div className="relative w-full h-full" style={{ minHeight: `${Math.max(1, lanes.length) * 44 + 16}px` }}>
                                                    {taskElements}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* GLOBAL REAL-TIME "NOW" INDICATOR OVERLAY */}
                        {(() => {
                            const todayIndex = timelineData.days.findIndex(d => isToday(d));
                            if (todayIndex === -1) return null;
                            
                            const dayProgress = (now.getHours() * 60 + now.getMinutes()) / 1440;
                            
                            return (
                                <div 
                                    className="absolute inset-y-0 w-0.5 bg-[#ff3b30] shadow-[0_0_20px_rgba(255,59,48,0.7)] z-[50] pointer-events-none transition-all duration-1000 ease-linear"
                                    style={{ 
                                        left: `calc(var(--sticky-width) + (${todayIndex} * var(--col-width)) + (${dayProgress} * var(--col-width)))` 
                                    }}
                                >
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#ff3b30] border-2 border-white shadow-xl flex items-center justify-center">
                                        <div className="w-1 h-1 bg-white rounded-full animate-ping" />
                                    </div>
                                    <div className="sticky top-20 left-0 -translate-x-1/2 flex flex-col items-center group/now z-[100] pointer-events-none self-start">
                                        <div className="bg-[#ff3b30] text-white text-[8px] font-black px-2.5 py-1 rounded-full shadow-[0_4px_12px_rgba(255,59,48,0.4)] whitespace-nowrap tracking-[0.1em] uppercase flex items-center gap-1.5 transition-transform group-hover/now:scale-110">
                                            <span className="w-1 h-1 bg-white rounded-full animate-pulse" />
                                            NOW • {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div className="w-0.5 h-4 bg-[#ff3b30]/30" />
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </div>

            {/* Employee Data Table */}
            <div className="bg-white rounded-[40px] shadow-sm border border-[#eceef0] overflow-hidden flex flex-col">
                <div className="px-8 py-6 border-b border-[#f5f5f7] flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-black text-[#1d1d1f] tracking-tight">Team Overview</h3>
                        <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mt-0.5">Resource Allocation & Metrics</p>
                    </div>
                    <Badge variant="default" className="bg-[#f5f5f7] text-[#1d1d1f] border-none font-black text-[9px] px-3 py-1">
                        {employees.length} MEMBERS
                    </Badge>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#fbfbfd]">
                                <th className="px-8 py-4 text-[10px] font-black text-[#86868b] uppercase tracking-widest border-b border-[#f5f5f7]">Member</th>
                                <th className="px-8 py-4 text-[10px] font-black text-[#86868b] uppercase tracking-widest border-b border-[#f5f5f7]">Role</th>
                                <th className="px-8 py-4 text-[10px] font-black text-[#86868b] uppercase tracking-widest border-b border-[#f5f5f7]">Active Tasks</th>
                                <th className="px-8 py-4 text-[10px] font-black text-[#86868b] uppercase tracking-widest border-b border-[#f5f5f7]">Done</th>
                                <th className="px-8 py-4 text-[10px] font-black text-[#86868b] uppercase tracking-widest border-b border-[#f5f5f7]">Workload</th>
                                <th className="px-8 py-4 text-[10px] font-black text-[#86868b] uppercase tracking-widest border-b border-[#f5f5f7] text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employees.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())).map((emp, idx) => {
                                const empTasks = tasks.filter(t => t.employee_id === emp.id);
                                const activeCount = empTasks.filter(t => t.status !== 'Completed').length;
                                const doneCount = empTasks.filter(t => t.status === 'Completed').length;
                                const workload = Math.min((activeCount / 5) * 100, 100); 
                                
                                return (
                                    <tr key={emp.id} className="group hover:bg-[#f5f5f7]/50 transition-colors">
                                        <td className="px-8 py-4 border-b border-[#f5f5f7]">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center text-[10px] font-black group-hover:bg-white transition-colors">
                                                    {emp.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-[#1d1d1f] leading-tight">{emp.name}</p>
                                                    <p className="text-[9px] font-bold text-[#86868b] truncate max-w-[150px]">{emp.email || 'No email provided'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 border-b border-[#f5f5f7]">
                                            <Badge variant={emp.role === 'manager' ? 'Urgent' : 'Medium'} className="text-[8px] px-2 py-0.5 uppercase">
                                                {emp.role}
                                            </Badge>
                                        </td>
                                        <td className="px-8 py-4 border-b border-[#f5f5f7]">
                                            <span className="text-xs font-bold text-[#1d1d1f]">{activeCount}</span>
                                        </td>
                                        <td className="px-8 py-4 border-b border-[#f5f5f7]">
                                            <span className="text-xs font-bold text-[#34c759]">{doneCount}</span>
                                        </td>
                                        <td className="px-8 py-4 border-b border-[#f5f5f7]">
                                            <div className="flex items-center gap-3">
                                                <div className="w-24 h-1.5 bg-[#f5f5f7] rounded-full overflow-hidden border border-[#e5e5ea]">
                                                    <div 
                                                        className={`h-full transition-all duration-1000 ${workload > 80 ? 'bg-[#ff3b30]' : workload > 50 ? 'bg-[#ff9500]' : 'bg-[#0071e3]'}`}
                                                        style={{ width: `${workload}%` }}
                                                    />
                                                </div>
                                                <span className="text-[9px] font-black text-[#86868b]">{Math.round(workload)}%</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4 border-b border-[#f5f5f7] text-right">
                                            <Button variant="secondary" className="h-8 px-3 text-[9px] font-black tracking-widest hover:bg-[#0071e3] hover:text-white border-none bg-[#f5f5f7] transition-all">
                                                VIEW ACTIVITY
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
