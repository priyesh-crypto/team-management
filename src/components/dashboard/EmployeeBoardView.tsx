"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Zap, CheckCircle2, Activity, MessageSquare, Paperclip, Pencil, X } from 'lucide-react';
import { Card, Badge, Button, Input } from '@/components/ui/components';
import { cn } from '@/lib/utils';
import { Task, Subtask, Profile, Priority, Status, Project } from '@/app/actions/actions';

// --- UI PRIMITIVES ---

function MorningBriefing({ 
    userName, 
    tasks, 
    efficiencyPercentage, 
    viewMode, 
    setViewMode 
}: { 
    userName: string, 
    tasks: Task[], 
    efficiencyPercentage: number, 
    viewMode: 'today' | 'overview', 
    setViewMode: (mode: 'today' | 'overview') => void 
}) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => {
        setMounted(true);
    }, []);

    const criticalTasks = tasks.filter(t => t.priority === 'Urgent' || t.priority === 'High');
    
    const greeting = React.useMemo(() => {
        if (!mounted) return "...";
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    }, [mounted]);

    const dateString = React.useMemo(() => {
        if (!mounted) return "...";
        return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }, [mounted]);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 relative"
        >
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="px-2.5 py-0.5 rounded-full bg-[#0071e3]/10 text-[#0071e3] text-[8px] font-bold tracking-widest uppercase border border-[#0071e3]/10">
                            Command Center
                        </div>
                        <span className="text-slate-400 text-[8px] font-bold uppercase tracking-widest">
                            Live · {dateString}
                        </span>
                    </div>
                    <h1 className="text-lg lg:text-xl font-black text-[#1d1d1f] tracking-tight">
                        {greeting}, <span className="text-slate-400">{userName?.split(' ')[0]}</span>.
                    </h1>
                    <p className="text-xs text-slate-500 font-medium max-w-2xl">
                        You have <span className="text-[#1d1d1f] font-bold">{criticalTasks.length} critical tasks</span>. 
                        Efficiency: <span className="text-[#0071e3] font-bold">{Math.round(efficiencyPercentage)}%</span>.
                    </p>
                </div>
                
                <div className="flex gap-2">
                    <div className="p-0.5 rounded-xl bg-[#f1f1f4] flex gap-0.5 border border-[#e5e5ea]">
                        <button 
                            onClick={() => setViewMode('today')}
                            className={cn(
                                "px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                                viewMode === 'today' ? "bg-white text-[#1d1d1f] shadow-sm" : "text-slate-500 hover:text-[#1d1d1f]"
                            )}
                        >
                            Today
                        </button>
                        <button 
                            onClick={() => setViewMode('overview')}
                            className={cn(
                                "px-4 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                                viewMode === 'overview' ? "bg-white text-[#1d1d1f] shadow-sm" : "text-slate-500 hover:text-[#1d1d1f]"
                            )}
                        >
                            Overview
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

function OverviewStats({ tasks, projects, efficiencyPercentage }: { tasks: Task[], projects: Project[], efficiencyPercentage: number }) {
    const completedTasks = tasks.filter(t => t.status === 'Completed').length;
    const totalTasks = tasks.length || 1;
    const completionRate = Math.round((completedTasks / totalTasks) * 100);
    
    const projectStats = projects.map(p => {
        const pTasks = tasks.filter(t => t.project_id === p.id);
        const pCompleted = pTasks.filter(t => t.status === 'Completed').length;
        const pTotal = pTasks.length || 1;
        return {
            name: p.name,
            progress: Math.round((pCompleted / pTotal) * 100),
            total: pTasks.length
        };
    }).filter(p => p.total > 0);

    return (
        <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-10"
        >
            <div className="lg:col-span-2 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className="p-6 bg-white border-[#f0f0f2] rounded-[24px] shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-[#34c759]/10 flex items-center justify-center text-[#34c759] shadow-sm"><CheckCircle2 size={18} /></div>
                            <div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Completion Rate</div>
                                <div className="text-xl font-bold text-[#1d1d1f] tracking-tight">{completionRate}%</div>
                            </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${completionRate}%` }}
                                className="h-full bg-[#34c759] rounded-full"
                            />
                        </div>
                    </Card>
                    <Card className="p-6 bg-white border-[#f0f0f2] rounded-[24px] shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-[#0071e3]/10 flex items-center justify-center text-[#0071e3] shadow-sm"><Activity size={18} /></div>
                            <div>
                                <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Velocity</div>
                                <div className="text-xl font-bold text-[#1d1d1f] tracking-tight">{Math.round(efficiencyPercentage)}%</div>
                            </div>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${efficiencyPercentage}%` }}
                                className="h-full bg-[#0071e3] rounded-full"
                            />
                        </div>
                    </Card>
                </div>

                <Card className="p-8 bg-white border-[#f0f0f2] rounded-[24px] shadow-sm">
                    <h4 className="text-[10px] font-bold text-[#1d1d1f] uppercase tracking-widest mb-8 flex items-center gap-2">
                        <Zap size={14} className="text-[#0071e3]" />
                        <span>Project Overview</span>
                    </h4>
                    <div className="space-y-6">
                        {projectStats.length > 0 ? projectStats.map(p => (
                            <div key={p.name} className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-700">{p.name}</span>
                                    <span className="text-[10px] font-bold text-slate-400 tracking-widest">{p.progress}%</span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${p.progress}%` }}
                                        className="h-full bg-[#0071e3] rounded-full"
                                    />
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-10 opacity-40">
                                <p className="text-xs font-medium text-slate-400">No project data available</p>
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <div className="space-y-6">
                <Card className="p-8 bg-[#1d1d1f] text-white border-none rounded-[24px] shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#0071e3] rounded-full blur-[60px] opacity-20 group-hover:opacity-30 transition-opacity duration-700" />
                    <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-10 relative z-10">Total Impact</h4>
                    <div className="space-y-8 relative z-10">
                        <div>
                            <div className="text-4xl font-bold tabular-nums tracking-tighter">{completedTasks}</div>
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Tasks Finished</div>
                        </div>
                        <div>
                            <div className="text-4xl font-bold tabular-nums tracking-tighter">{totalTasks}</div>
                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Total Assigned</div>
                        </div>
                    </div>
                </Card>
            </div>
        </motion.div>
    );
}

function BoardColumn({ 
    title, 
    tasks, 
    subtasksMap, 
    employees, 
    onTaskClick, 
    onDeleteTask, 
    commentCounts, 
    attachmentCounts,
    editingTaskId,
    setEditingTaskId,
    editTaskData,
    setEditTaskData,
    handleUpdateTask,
    mounted
}: { 
    title: string, 
    tasks: Task[], 
    subtasksMap: Record<string, Subtask[]>, 
    employees: Profile[], 
    onTaskClick: (task: Task) => void, 
    onDeleteTask: (taskId: string, taskName: string) => void, 
    commentCounts: Record<string, number>, 
    attachmentCounts: Record<string, number>,
    editingTaskId: string | null,
    setEditingTaskId: (id: string | null) => void,
    editTaskData: Partial<Task>,
    setEditTaskData: (data: Partial<Task>) => void,
    handleUpdateTask: (taskId: string) => Promise<void>,
    mounted: boolean
}) {
    return (
        <div className="flex flex-col h-full min-w-[280px] max-w-[280px] flex-shrink-0">
            <div className="flex items-center justify-between px-2 mb-4">
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "w-2 h-2 rounded-full shadow-sm", 
                        title.includes('Overdue') ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 
                        title.includes('To Do') ? 'bg-[#0071e3]' : 
                        title.includes('Progress') ? 'bg-orange-400' : 
                        title.includes('Blocked') ? 'bg-red-400' : 'bg-emerald-400'
                    )} />
                    <h3 className="text-[10px] font-bold text-slate-700 tracking-widest uppercase">{title}</h3>
                </div>
                <span className="text-[10px] font-bold text-slate-400 tabular-nums">{tasks.length}</span>
            </div>
            <div className="space-y-3 flex-1 pb-4 custom-scrollbar overflow-y-auto pr-1">
                {tasks.length === 0 ? (
                    <div className="h-32 border border-dashed border-slate-200 rounded-[24px] flex items-center justify-center bg-slate-50/50 text-[10px] font-bold text-slate-300 uppercase tracking-widest">No Tasks</div>
                ) : (
                    tasks.map(task => {
                        const startDateLabel = mounted && task.start_date ? new Date(task.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : (mounted ? '' : '...');
                        const deadlineLabel = mounted && task.deadline ? new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : (mounted ? '' : '...');
                        const dateRangeLabel = mounted ? `${startDateLabel} - ${deadlineLabel}` : '...';
                        const dateInfo = { label: dateRangeLabel, color: 'bg-slate-50 text-slate-400' };
                        const subtasks = subtasksMap[task.id] || [];
                        const completedSubtasks = subtasks.filter(s => s.is_completed).length;
                        let progress = 0;
                        if (subtasks.length > 0) {
                            progress = Math.round((completedSubtasks / subtasks.length) * 100);
                        } else {
                            switch (task.status) {
                                case 'Completed': progress = 100; break;
                                case 'In Review': progress = 80; break;
                                case 'In Progress': progress = 50; break;
                                case 'Blocked': progress = 15; break;
                                default: progress = 0;
                            }
                        }
                        const isOverdueTask = task.status === 'Overdue' || (task.deadline && new Date(task.deadline).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && task.status !== 'Completed');
                        
                        return (
                            <motion.div 
                                key={task.id} 
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                whileHover={{ y: -3, boxShadow: "0 8px 24px -4px rgba(0,0,0,0.06)" }} 
                                onClick={() => onTaskClick(task)} 
                                className="p-4 rounded-[20px] bg-white border border-slate-100/80 cursor-pointer shadow-sm relative group transition-all duration-500"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between">
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant={task.priority}>
                                                {task.priority || 'Medium'}
                                            </Badge>
                                            {dateInfo && (
                                                <Badge className="bg-slate-50 text-slate-400 border-slate-100 whitespace-nowrap">
                                                    {dateInfo.label}
                                                </Badge>
                                            )}
                                            {isOverdueTask && (
                                                <Badge className="bg-red-500 text-white border-none shadow-sm animate-pulse">
                                                    OVERDUE
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {editingTaskId === task.id ? (
                                        <div className="flex flex-col gap-2 w-full" onClick={e => e.stopPropagation()}>
                                            <input 
                                                value={editTaskData.name || ''} 
                                                onChange={e => setEditTaskData({ ...editTaskData, name: e.target.value })}
                                                onKeyDown={e => e.key === 'Enter' && handleUpdateTask(task.id)}
                                                autoFocus
                                                className="text-[12px] font-bold text-slate-800 bg-slate-50 rounded-lg px-2 py-1.5 outline-none w-full border border-slate-200"
                                                placeholder="Task Name"
                                            />
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <div className="flex items-center gap-1 bg-slate-50 rounded-lg px-1.5 py-1 border border-slate-100">
                                                    <span className="text-[7px] font-black text-slate-400 uppercase">Start</span>
                                                    <input 
                                                        type="date"
                                                        value={editTaskData.start_date ? new Date(editTaskData.start_date).toISOString().split('T')[0] : ''} 
                                                        onChange={e => setEditTaskData({ ...editTaskData, start_date: e.target.value })}
                                                        className="text-[9px] font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1 bg-slate-50 rounded-lg px-1.5 py-1 border border-slate-100">
                                                    <span className="text-[7px] font-black text-slate-400 uppercase">End</span>
                                                    <input 
                                                        type="date"
                                                        value={editTaskData.deadline ? new Date(editTaskData.deadline).toISOString().split('T')[0] : ''} 
                                                        onChange={e => setEditTaskData({ ...editTaskData, deadline: e.target.value })}
                                                        className="text-[9px] font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
                                                    />
                                                </div>
                                                <div className="flex gap-1 ml-auto">
                                                    <button 
                                                        onClick={() => handleUpdateTask(task.id)}
                                                        className="p-1 bg-[#0071e3] text-white rounded-md hover:bg-[#005bb7] transition-colors"
                                                    >
                                                        <CheckCircle2 size={12} strokeWidth={3} />
                                                    </button>
                                                    <button 
                                                        onClick={() => setEditingTaskId(null)}
                                                        className="p-1 bg-white text-slate-400 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors"
                                                    >
                                                        <X size={12} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <h4 className="text-[13px] font-bold text-slate-800 leading-snug tracking-tight group-hover:text-[#0071e3] transition-colors line-clamp-2 flex items-center justify-between gap-2">
                                            {task.name}
                                            <button 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setEditingTaskId(task.id); 
                                                    setEditTaskData(task); 
                                                }} 
                                                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-[#0071e3] transition-all p-1 hover:bg-[#0071e3]/5 rounded-md"
                                            >
                                                <Pencil size={11} strokeWidth={2.5} />
                                            </button>
                                        </h4>
                                    )}

                                    <div className="space-y-2.5">
                                        <div className="flex items-center justify-between text-[9px] font-bold tracking-widest uppercase mb-1">
                                            <span className="text-slate-400">Progress</span>
                                            <span className="text-slate-900">{progress}%</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
                                            <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                className="h-full bg-gradient-to-r from-[#0071e3] to-[#00c6ff] rounded-full transition-all duration-1000"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                        <div className="flex -space-x-2 shrink-0">
                                            {[task.employee_id, ...(task.assignee_ids || [])].slice(0, 3).map(id => {
                                                const emp = employees.find(e => e.id === id);
                                                return (
                                                    <div 
                                                        key={`${task.id}-${id}`} 
                                                        className="w-7 h-7 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[9px] font-bold text-slate-500 shadow-sm"
                                                    >
                                                        {emp?.name?.charAt(0) || '?'}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400">
                                            <div className="flex items-center gap-1.5 group-hover:text-slate-600 transition-colors">
                                                <MessageSquare size={13} strokeWidth={2.5} />
                                                <span className="tabular-nums">{commentCounts[task.id] || 0}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 group-hover:text-slate-600 transition-colors">
                                                <Paperclip size={13} strokeWidth={2.5} />
                                                <span className="tabular-nums">{attachmentCounts[task.id] || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

interface EmployeeBoardViewProps {
    userId: string;
    userName: string;
    profileName: string;
    activeTab: string;
    viewMode: 'today' | 'overview';
    setViewMode: (mode: 'today' | 'overview') => void;
    myTasks: Task[];
    allTasks: Task[];
    employees: Profile[];
    projects: Project[];
    subtasksMap: Record<string, Subtask[]>;
    commentCounts: Record<string, number>;
    attachmentCounts: Record<string, number>;
    efficiencyPercentage: number;
    openTaskSheet: (task: Task) => void;
    handleDeleteTask: (taskId: string, taskName: string) => void;
    handleUpdateTask: (taskId: string) => Promise<void>;
    editingTaskId: string | null;
    setEditingTaskId: (id: string | null) => void;
    editTaskData: Partial<Task>;
    setEditTaskData: (data: Partial<Task>) => void;
}

export function EmployeeBoardView({
    userId,
    userName,
    profileName,
    activeTab,
    viewMode,
    setViewMode,
    myTasks,
    allTasks,
    employees,
    projects,
    subtasksMap,
    commentCounts,
    attachmentCounts,
    efficiencyPercentage,
    openTaskSheet,
    handleDeleteTask,
    handleUpdateTask,
    editingTaskId,
    setEditingTaskId,
    editTaskData,
    setEditTaskData
}: EmployeeBoardViewProps) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => {
        setMounted(true);
    }, []);

    const isOverdue = (t: Task) => t.status === 'Overdue' || (t.deadline && new Date(t.deadline).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && t.status !== 'Completed');

    if (activeTab === 'settings' || activeTab === 'schedule') return null;

    if (viewMode === 'overview') {
        return (
            <>
                <MorningBriefing 
                    userName={profileName || userName} 
                    tasks={myTasks} 
                    efficiencyPercentage={efficiencyPercentage} 
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                />
                <OverviewStats tasks={myTasks} projects={projects} efficiencyPercentage={efficiencyPercentage} />
            </>
        );
    }

    return (
        <div className="space-y-4">
            <MorningBriefing 
                userName={profileName || userName} 
                tasks={myTasks} 
                efficiencyPercentage={efficiencyPercentage} 
                viewMode={viewMode}
                setViewMode={setViewMode}
            />

            {activeTab === 'mine' ? (
                <div className="fade-in h-[calc(100vh-200px)] flex flex-col">
                    <div className="flex items-center justify-between mb-5 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#0071e3]/10 flex items-center justify-center text-[#0071e3]"><Zap size={18} strokeWidth={2.5} /></div>
                            <h3 className="text-xl font-black text-[#1d1d1f] tracking-tight">My Workspace</h3>
                        </div>
                        <div className="px-3 py-1.5 bg-white rounded-xl border border-[#f0f0f2] shadow-sm flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#34c759] animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#86868b]">{myTasks.length} Active</span>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-x-auto pb-6 custom-scrollbar -mx-6 px-6">
                        <div className="flex gap-4 h-full min-w-max">
                            {['Overdue', 'To Do', 'In Progress', 'Blocked', 'Completed'].map(status => (
                                <BoardColumn 
                                    key={status}
                                    title={status} 
                                    tasks={myTasks.filter(t => {
                                        if (status === 'Overdue') return isOverdue(t);
                                        return t.status === status && !isOverdue(t);
                                    })} 
                                    subtasksMap={subtasksMap} 
                                    employees={employees} 
                                    onTaskClick={openTaskSheet} 
                                    onDeleteTask={handleDeleteTask} 
                                    commentCounts={commentCounts}
                                    attachmentCounts={attachmentCounts}
                                    editingTaskId={editingTaskId}
                                    setEditingTaskId={setEditingTaskId}
                                    editTaskData={editTaskData}
                                    setEditTaskData={setEditTaskData}
                                    handleUpdateTask={handleUpdateTask}
                                    mounted={mounted}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="max-w-4xl mx-auto fade-in pb-6">
                    <Card className="bg-gradient-to-br from-[#0071e3] to-[#00c6ff] border-none mb-5 p-5 text-white">
                        <h3 className="text-xl font-black mb-1">Team Hub</h3>
                        <p className="text-sm opacity-80">Real-time collaboration across the team.</p>
                    </Card>
                    <div className="flex overflow-x-auto pb-6 custom-scrollbar -mx-6 px-6 h-[calc(100vh-260px)] min-h-[400px]">
                        {['Overdue', 'To Do', 'In Progress', 'Blocked', 'Completed'].map(status => (
                            <BoardColumn 
                                key={status}
                                title={status} 
                                tasks={allTasks.filter(t => {
                                    const matchesStatus = (status === 'Overdue') ? isOverdue(t) : (t.status === status && !isOverdue(t));
                                    return matchesStatus && t.employee_id !== userId;
                                })} 
                                subtasksMap={subtasksMap} 
                                employees={employees} 
                                onTaskClick={openTaskSheet} 
                                onDeleteTask={handleDeleteTask} 
                                commentCounts={commentCounts} 
                                attachmentCounts={attachmentCounts} 
                                editingTaskId={editingTaskId} 
                                setEditingTaskId={setEditingTaskId} 
                                editTaskData={editTaskData} 
                                setEditTaskData={setEditTaskData} 
                                handleUpdateTask={handleUpdateTask} 
                                mounted={mounted}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
