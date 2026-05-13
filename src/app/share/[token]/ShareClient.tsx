"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { 
    Calendar, 
    Clock, 
    CheckCircle2, 
    Layers, 
    Layout, 
    Users, 
    ArrowUpRight,
    Search,
    Filter,
    MoreHorizontal,
    Share2,
    ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/components';
import { UserAvatar } from '@/components/ui/UserAvatar';

interface ShareClientProps {
    tokenRow: any;
    resource: any;
    tasks: any[];
    subtasksMap: Record<string, any[]>;
    employees: any[];
}

export function ShareClient({ 
    tokenRow, 
    resource, 
    tasks = [], 
    subtasksMap = {}, 
    employees = [] 
}: ShareClientProps) {
    const isProject = tokenRow.resource_type === 'project';
    
    // Calculate total progress
    const calculateProgress = () => {
        if (tasks.length === 0) return 0;
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'Completed').length;
        
        // Use subtasks for more granularity if available
        let totalWeight = 0;
        let completedWeight = 0;
        
        tasks.forEach(task => {
            const subtasks = subtasksMap[task.id] || [];
            if (task.status === 'Completed') {
                totalWeight += 100;
                completedWeight += 100;
            } else if (subtasks.length > 0) {
                const taskTotal = subtasks.length;
                const taskDone = subtasks.filter(s => s.is_completed).length;
                totalWeight += 100;
                completedWeight += (taskDone / taskTotal) * 100;
            } else {
                totalWeight += 100;
                if (task.status === 'In Review') completedWeight += 85;
                else if (task.status === 'In Progress') completedWeight += 50;
            }
        });
        
        return Math.round((completedWeight / totalWeight) * 100);
    };

    const progress = calculateProgress();
    const activeTasks = tasks.filter(t => t.status !== 'Completed').length;

    return (
        <div className="min-h-screen bg-[#f8f9fb] text-[#1d1d1f] font-sans selection:bg-[#0051e6]/10 selection:text-[#0051e6]">
            {/* Navigation / Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-[#eceef0] px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#0051e6] to-[#00c6ff] flex items-center justify-center shadow-lg shadow-[#0051e6]/20">
                            <Layout className="text-white" size={20} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-base font-black tracking-tight leading-none">Knotless <span className="text-[#0051e6]">Portal</span></h1>
                            <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mt-1">External Project View</p>
                        </div>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-6">
                        <div className="flex items-center gap-2 px-4 py-2 bg-[#f1f2f4] rounded-2xl border border-[#eceef0]">
                            <div className="w-2 h-2 rounded-full bg-[#34c759] animate-pulse" />
                            <span className="text-[11px] font-black uppercase tracking-wider text-[#1d1d1f]">Live Sync Active</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Left Column: Project Overview */}
                    <div className="lg:col-span-4 space-y-6">
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-[32px] p-8 border border-[#eceef0] shadow-sm relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-[#0051e6]/[0.02] rounded-full -mr-16 -mt-16" />
                            
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-6">
                                    <Badge className="bg-[#0051e6]/10 text-[#0051e6] border-none text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                                        {isProject ? 'Project' : 'Task'}
                                    </Badge>
                                    <Badge className="bg-[#f1f2f4] text-[#86868b] border-none text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
                                        Read Only
                                    </Badge>
                                </div>

                                <h2 className="text-3xl font-black tracking-tight mb-4 leading-tight">
                                    {resource.name}
                                </h2>
                                
                                <p className="text-sm font-medium text-[#86868b] leading-relaxed mb-8">
                                    {resource.description || resource.notes || 'No overview provided for this project.'}
                                </p>

                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-end">
                                            <span className="text-[11px] font-black uppercase tracking-widest text-[#86868b]">Overall Completion</span>
                                            <span className="text-2xl font-black text-[#0051e6] tabular-nums">{progress}%</span>
                                        </div>
                                        <div className="h-3 w-full bg-[#f1f2f4] rounded-full overflow-hidden">
                                            <motion.div 
                                                className="h-full bg-gradient-to-r from-[#0051e6] to-[#00c6ff] rounded-full"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                transition={{ duration: 1.5, ease: "easeOut" }}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-[#f8f9fb] p-4 rounded-[24px] border border-[#eceef0]">
                                            <div className="text-[10px] font-black text-[#86868b] uppercase tracking-widest mb-1">Total Tasks</div>
                                            <div className="text-xl font-black">{tasks.length}</div>
                                        </div>
                                        <div className="bg-[#f8f9fb] p-4 rounded-[24px] border border-[#eceef0]">
                                            <div className="text-[10px] font-black text-[#86868b] uppercase tracking-widest mb-1">In Progress</div>
                                            <div className="text-xl font-black text-[#0051e6]">{activeTasks}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        {/* Timeline / Deadlines */}
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white rounded-[32px] p-8 border border-[#eceef0] shadow-sm"
                        >
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#86868b] mb-6">Delivery Timeline</h3>
                            
                            <div className="space-y-6">
                                {tasks.filter(t => t.deadline).slice(0, 3).map((t, idx) => (
                                    <div key={t.id} className="flex gap-4">
                                        <div className="flex flex-col items-center">
                                            <div className={cn(
                                                "w-3 h-3 rounded-full mt-1.5 border-2 border-white shadow-sm",
                                                t.status === 'Completed' ? "bg-[#34c759]" : "bg-[#0051e6]"
                                            )} />
                                            {idx < 2 && <div className="w-0.5 flex-1 bg-[#eceef0] my-1" />}
                                        </div>
                                        <div>
                                            <div className="text-[10px] font-black text-[#86868b] uppercase tracking-widest mb-0.5">
                                                {new Date(t.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                            </div>
                                            <div className="text-sm font-bold text-[#1d1d1f] line-clamp-1">{t.name}</div>
                                        </div>
                                    </div>
                                ))}
                                {tasks.filter(t => t.deadline).length === 0 && (
                                    <div className="text-sm font-medium text-[#86868b] italic">No deadlines set.</div>
                                )}
                            </div>
                        </motion.div>

                        {/* Team */}
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white rounded-[32px] p-8 border border-[#eceef0] shadow-sm"
                        >
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#86868b] mb-6">Expert Team</h3>
                            <div className="flex flex-wrap gap-3">
                                {employees.map(emp => (
                                    <div key={emp.id} className="group flex items-center gap-3 bg-[#f8f9fb] pr-4 py-2 pl-2 rounded-2xl border border-[#eceef0] transition-all hover:border-[#0051e6]/30">
                                        <UserAvatar 
                                            name={emp.name} 
                                            avatarUrl={emp.avatar_url}
                                            className="w-8 h-8 rounded-xl shadow-sm"
                                            textClassName="text-[10px] font-black"
                                        />
                                        <div>
                                            <div className="text-[11px] font-black text-[#1d1d1f]">{emp.name}</div>
                                            <div className="text-[8px] font-bold text-[#86868b] uppercase tracking-widest">Contributor</div>
                                        </div>
                                    </div>
                                ))}
                                {employees.length === 0 && (
                                    <div className="text-sm font-medium text-[#86868b] italic">No team data available.</div>
                                )}
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Column: Task List */}
                    <div className="lg:col-span-8">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-2xl font-black tracking-tight">Active Roadmap</h3>
                                <p className="text-sm font-medium text-[#86868b]">Tracking {tasks.length} deliverables in real-time.</p>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white rounded-2xl border border-[#eceef0] shadow-sm">
                                    <Search size={14} className="text-[#86868b]" />
                                    <span className="text-[11px] font-bold text-[#86868b]">Search tasks...</span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {tasks.map((task, idx) => {
                                const subtasks = subtasksMap[task.id] || [];
                                const doneSubtasks = subtasks.filter(s => s.is_completed).length;
                                const hasSubtasks = subtasks.length > 0;
                                
                                return (
                                    <motion.div 
                                        key={task.id}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="group bg-white rounded-[28px] p-6 border border-[#eceef0] shadow-sm hover:shadow-xl hover:shadow-[#0051e6]/5 transition-all duration-500"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                            <div className="flex items-start gap-4">
                                                <div className={cn(
                                                    "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-colors",
                                                    task.status === 'Completed' ? "bg-[#34c759]/10 text-[#34c759]" : 
                                                    task.status === 'Blocked' ? "bg-[#ff3b30]/10 text-[#ff3b30]" : "bg-[#0051e6]/10 text-[#0051e6]"
                                                )}>
                                                    {task.status === 'Completed' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Badge className={cn(
                                                            "text-[8px] font-black px-2 py-0.5 rounded-lg border-none",
                                                            task.priority === 'Urgent' ? 'bg-[#ff3b30] text-white' : 
                                                            task.priority === 'High' ? 'bg-[#ff9500] text-white' : 
                                                            task.priority === 'Medium' ? 'bg-[#0051e6] text-white' : 'bg-[#34c759] text-white'
                                                        )}>
                                                            {task.priority.toUpperCase()}
                                                        </Badge>
                                                        {task.status === 'Blocked' && (
                                                            <Badge className="bg-[#ff3b30] text-white text-[8px] font-black px-2 py-0.5 rounded-lg border-none animate-pulse">
                                                                BLOCKED
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <h4 className="text-base font-black text-[#1d1d1f] tracking-tight">{task.name}</h4>
                                                    <div className="flex flex-wrap items-center gap-4 mt-2">
                                                        {task.deadline && (
                                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#86868b] uppercase tracking-wider">
                                                                <Calendar size={12} />
                                                                {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                            </div>
                                                        )}
                                                        {hasSubtasks && (
                                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#86868b] uppercase tracking-wider">
                                                                <Layers size={12} />
                                                                {doneSubtasks}/{subtasks.length} Checkpoints
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center justify-between sm:justify-end gap-6 sm:pl-6 sm:border-l border-[#eceef0]">
                                                <div className="text-right">
                                                    <div className="text-[9px] font-black text-[#86868b] uppercase tracking-widest mb-1">Status</div>
                                                    <div className={cn(
                                                        "text-[12px] font-black uppercase tracking-wider",
                                                        task.status === 'Completed' ? "text-[#34c759]" : 
                                                        task.status === 'Blocked' ? "text-[#ff3b30]" : "text-[#0051e6]"
                                                    )}>
                                                        {task.status}
                                                    </div>
                                                </div>
                                                <div className="w-8 h-8 rounded-full border border-[#eceef0] flex items-center justify-center text-[#86868b] group-hover:bg-[#0051e6] group-hover:text-white transition-all">
                                                    <ArrowUpRight size={14} />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}

                            {tasks.length === 0 && (
                                <div className="py-20 text-center">
                                    <div className="w-16 h-16 rounded-[24px] bg-[#f1f2f4] flex items-center justify-center mx-auto mb-4 text-[#86868b]">
                                        <Layers size={32} />
                                    </div>
                                    <h4 className="text-lg font-black tracking-tight text-[#1d1d1f]">No tasks visible</h4>
                                    <p className="text-sm font-medium text-[#86868b] max-w-xs mx-auto mt-2">The team hasn't shared any specific milestones for this project link yet.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-[#eceef0]">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-[#86868b] uppercase tracking-[0.2em]">Powered by</span>
                        <span className="text-[11px] font-black text-[#0051e6] uppercase tracking-[0.2em]">Knotless AI</span>
                    </div>
                    
                    <div className="text-[11px] font-bold text-[#86868b]">
                        This is a secure, read-only view of the project for authorized stakeholders.
                    </div>
                    
                    <div className="flex items-center gap-4 text-[#86868b]">
                        <Share2 size={16} className="cursor-pointer hover:text-[#0051e6] transition-colors" />
                        <ExternalLink size={16} className="cursor-pointer hover:text-[#0051e6] transition-colors" />
                    </div>
                </div>
            </footer>
        </div>
    );
}
