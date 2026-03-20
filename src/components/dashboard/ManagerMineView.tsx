"use client";

import React from 'react';
import { Pencil, Menu, Calendar, Clock, Plus, Zap, Trash2 } from 'lucide-react';
import { Card, Badge, Input, Select } from '@/components/ui/components';
import { Task, Subtask, Profile, Priority, Status, Project } from '@/app/actions/actions';

interface ManagerMineViewProps {
    userId: string;
    userName: string;
    orgId: string;
    projectId?: string;
    tasks: Task[];
    employees: Profile[];
    projects: Project[];
    subtasksMap: Record<string, Subtask[]>;
    editingTaskId: string | null;
    setEditingTaskId: (id: string | null) => void;
    editTaskData: Partial<Task>;
    setEditTaskData: (data: Partial<Task>) => void;
    handleUpdateTask: (taskId: string) => Promise<void>;
    setSelectedTask: (task: { task: Task, subtasks: Subtask[] } | null) => void;
    handleToggleSubtask: (taskId: string, subtaskId: string, is_completed: boolean) => Promise<void>;
    editingSubtaskId: string | null;
    setEditingSubtaskId: (id: string | null) => void;
    editSubtaskData: Partial<Subtask>;
    setEditSubtaskData: (data: Partial<Subtask>) => void;
    handleSaveSubtaskEdit: (taskId: string) => Promise<void>;
    logForm: any;
    setLogForm: (form: any) => void;
    handleLogSubmit: (e: React.FormEvent) => Promise<void>;
    isSavingLog: boolean;
    logError: string | null;
    mounted: boolean;
    // Timer & Subtask Props
    activeTimers: Record<string, string>;
    handleStartTimer: (subtaskId: string, taskId: string) => void;
    handleStopTimer: (subtaskId: string, taskId: string) => void;
    formatElapsed: (startTimeIso: string) => string;
    newSubtaskData: Record<string, any>;
    setNewSubtaskData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
    handleAddSubtask: (taskId: string) => Promise<void>;
    handleDeleteSubtask: (taskId: string, subtaskId: string, name: string) => void;
}

export function ManagerMineView({
    userId,
    userName,
    orgId,
    projectId,
    tasks,
    employees,
    projects,
    subtasksMap,
    editingTaskId,
    setEditingTaskId,
    editTaskData,
    setEditTaskData,
    handleUpdateTask,
    setSelectedTask,
    handleToggleSubtask,
    editingSubtaskId,
    setEditingSubtaskId,
    editSubtaskData,
    setEditSubtaskData,
    handleSaveSubtaskEdit,
    logForm,
    setLogForm,
    handleLogSubmit,
    isSavingLog,
    logError,
    mounted,
    activeTimers,
    handleStartTimer,
    handleStopTimer,
    formatElapsed,
    newSubtaskData,
    setNewSubtaskData,
    handleAddSubtask,
    handleDeleteSubtask
}: ManagerMineViewProps) {
    const myActiveTasks = tasks.filter(t => (t.employee_id === userId || (t.assignee_ids && t.assignee_ids.includes(userId))) && t.status !== 'Completed');
    const myCompletedTasks = tasks.filter(t => (t.employee_id === userId || (t.assignee_ids && t.assignee_ids.includes(userId))) && t.status === 'Completed');

    const renderTaskCard = (task: Task) => (
        <Card key={task.id} className="p-6 rounded-[32px] border-[#eceef0] shadow-sm bg-white overflow-hidden group/task">
            <div className="flex flex-col gap-6">
                {/* Task Header */}
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            {editingTaskId === task.id ? (
                                <div className="flex flex-col gap-2 w-full">
                                    <input 
                                        value={editTaskData.name || ''} 
                                        onChange={e => setEditTaskData({ ...editTaskData, name: e.target.value })}
                                        onKeyDown={e => e.key === 'Enter' && handleUpdateTask(task.id)}
                                        autoFocus
                                        className="text-base font-black text-[#1d1d1f] tracking-tight bg-[#f5f5f7] rounded-lg px-2 py-1 outline-none w-full"
                                        placeholder="Task Name"
                                    />
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1 bg-[#f5f5f7] rounded-lg px-2 py-1">
                                            <span className="text-[8px] font-black text-[#86868b] uppercase">Start</span>
                                            <input 
                                                type="date"
                                                value={editTaskData.start_date ? new Date(editTaskData.start_date).toISOString().split('T')[0] : ''} 
                                                onChange={e => setEditTaskData({ ...editTaskData, start_date: e.target.value })}
                                                className="text-[10px] font-bold text-[#1d1d1f] bg-transparent outline-none cursor-pointer"
                                            />
                                        </div>
                                        <div className="flex items-center gap-1 bg-[#f5f5f7] rounded-lg px-2 py-1">
                                            <span className="text-[8px] font-black text-[#86868b] uppercase">End</span>
                                            <input 
                                                type="date"
                                                value={editTaskData.deadline ? new Date(editTaskData.deadline).toISOString().split('T')[0] : ''} 
                                                onChange={e => setEditTaskData({ ...editTaskData, deadline: e.target.value })}
                                                className="text-[10px] font-bold text-[#1d1d1f] bg-transparent outline-none cursor-pointer"
                                            />
                                        </div>
                                        <button 
                                            onClick={() => handleUpdateTask(task.id)}
                                            className="ml-auto px-3 py-1 bg-[#0071e3] text-white text-[9px] font-black rounded-lg hover:bg-[#005bb7] transition-colors shadow-sm"
                                        >
                                            SAVE
                                        </button>
                                        <button 
                                            onClick={() => setEditingTaskId(null)}
                                            className="px-3 py-1 bg-white text-[#86868b] text-[9px] font-black rounded-lg border border-[#eceef0] hover:bg-[#f5f5f7] transition-colors"
                                        >
                                            CANCEL
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <h4 className="text-base font-black text-[#1d1d1f] tracking-tight group-hover/task:text-[#0071e3] transition-colors flex items-center gap-2">
                                    {task.name}
                                    <button onClick={(e) => { e.stopPropagation(); setEditingTaskId(task.id); setEditTaskData(task); }} className="opacity-0 group-hover/task:opacity-100 text-[#d2d2d7] hover:text-[#0071e3] transition-all">
                                        <Pencil size={12} />
                                    </button>
                                </h4>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge className={`${task.priority === 'Urgent' ? 'bg-[#ff3b30]/10 text-[#ff3b30]' : task.priority === 'High' ? 'bg-[#ff9500]/10 text-[#ff9500]' : 'bg-[#0071e3]/10 text-[#0071e3]'} border-none px-2 py-0.5 rounded-md font-bold text-[8px] uppercase tracking-widest`}>
                                {task.priority}
                            </Badge>
                            <Badge className="bg-[#f5f5f7] text-[#86868b] border-none px-2 py-0.5 rounded-md font-bold text-[8px] uppercase tracking-widest">
                                {task.status}
                            </Badge>
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#f5f5f7] rounded-md text-[8px] font-bold text-[#86868b] uppercase tracking-widest">
                                <Calendar size={10} />
                                <span>{new Date(task.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - {new Date(task.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                            </div>
                            <div className="flex items-center gap-1.5 ml-2 text-[9px] font-black text-[#86868b]">
                                <span>⏱️</span>
                                <span className="tabular-nums">{(task.hours_spent || 0).toFixed(2)} HRS LOGGED</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setSelectedTask({ task, subtasks: subtasksMap[task.id] || [] })}
                            className="p-2.5 rounded-2xl bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#0071e3] hover:text-white transition-all shadow-sm"
                        >
                            <Menu size={16} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                {/* Work Log / Subtasks Section */}
                <div className="space-y-4">
                    <h5 className="text-[9px] font-black text-[#86868b] uppercase tracking-widest flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#0071e3]"></div>
                        Work History & Daily Logs
                    </h5>
                    
                    <div className="space-y-2">
                        {(subtasksMap[task.id] || []).map(subtask => (
                            <div key={subtask.id} className="group/sub relative flex items-center justify-between p-4 bg-[#f5f5f7]/50 hover:bg-[#f5f5f7] rounded-2xl transition-all border border-transparent hover:border-[#eceef0]">
                                <div className="flex items-center gap-4 flex-1">
                                    <input 
                                        type="checkbox"
                                        id={`subtask-${subtask.id}`}
                                        checked={subtask.is_completed}
                                        onChange={(e) => handleToggleSubtask(task.id, subtask.id, e.target.checked)}
                                        className="w-5 h-5 rounded-lg border-2 border-[#d2d2d7] text-[#34c759] focus:ring-[#34c759] transition-all cursor-pointer accent-[#34c759]"
                                    />
                                    <div className="flex-1">
                                        {editingSubtaskId === subtask.id ? (
                                            <div className="flex flex-col gap-3 p-2 bg-white rounded-xl shadow-sm border border-[#e5e5ea]">
                                                <input 
                                                    value={editSubtaskData.name || ''} 
                                                    onChange={e => setEditSubtaskData({ ...editSubtaskData, name: e.target.value })}
                                                    className="text-[11px] font-bold text-[#1d1d1f] bg-white rounded-lg px-2 py-1 outline-none flex-1 border border-[#eceef0]"
                                                    placeholder="Subtask name..."
                                                />
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 flex flex-col items-center bg-[#f5f5f7] px-2 py-1 rounded-lg">
                                                        <span className="text-[8px] font-black text-[#86868b] uppercase">Hours</span>
                                                        <input 
                                                            type="number"
                                                            step="0.25"
                                                            value={editSubtaskData.hours_spent || 0} 
                                                            onChange={e => setEditSubtaskData({ ...editSubtaskData, hours_spent: Number(e.target.value) })}
                                                            className="text-[11px] font-black text-[#1d1d1f] bg-transparent outline-none w-12 text-center"
                                                        />
                                                    </div>
                                                    <button 
                                                        onClick={() => handleSaveSubtaskEdit(task.id)} 
                                                        className="px-4 py-2 bg-[#0071e3] text-white text-[9px] font-black rounded-lg hover:bg-[#005bb7] transition-colors"
                                                    >
                                                        SAVE
                                                    </button>
                                                    <button 
                                                        onClick={() => setEditingSubtaskId(null)}
                                                        className="px-4 py-2 bg-[#f5f5f7] text-[#1d1d1f] text-[9px] font-black rounded-lg hover:bg-[#e5e5ea] transition-colors"
                                                    >
                                                        X
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <span className={`text-[11px] font-bold ${subtask.is_completed ? 'text-[#86868b] line-through decoration-2' : 'text-[#1d1d1f]'}`}>
                                                    {subtask.name}
                                                </span>
                                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/80 rounded-md border border-[#eceef0] shadow-sm">
                                                    <span className="text-[10px] font-black text-[#0071e3]">{subtask.hours_spent}h</span>
                                                    <div className="w-[1px] h-2 bg-[#eceef0]"></div>
                                                    <span className="text-[9px] font-bold text-[#86868b] uppercase tabular-nums">{mounted && subtask.date_logged ? new Date(subtask.date_logged).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '...'}</span>
                                                </div>
                                                {subtask.start_time && (
                                                    <span className="text-[9px] font-bold text-[#86868b] opacity-40 tabular-nums">
                                                        {subtask.start_time} - {subtask.end_time}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    {activeTimers[subtask.id] ? (
                                        <button 
                                            onClick={() => handleStopTimer(subtask.id, task.id)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-[#ff3b30] text-white rounded-xl text-[9px] font-black animate-pulse shadow-lg shadow-[#ff3b30]/20"
                                        >
                                            <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
                                            {formatElapsed(activeTimers[subtask.id])}
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => handleStartTimer(subtask.id, task.id)}
                                            className="opacity-0 group-hover/sub:opacity-100 text-[#86868b] hover:text-[#0071e3] transition-all p-1"
                                            title="Start Timer"
                                        >
                                            <Clock size={14} strokeWidth={2.5} />
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => { setEditingSubtaskId(subtask.id); setEditSubtaskData(subtask); }}
                                        className="opacity-0 group-hover/sub:opacity-100 text-[#86868b] hover:text-[#0071e3] transition-all p-1"
                                    >
                                        <Pencil size={12} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteSubtask(task.id, subtask.id, subtask.name)}
                                        className="opacity-0 group-hover/sub:opacity-100 text-[#86868b] hover:text-[#ff3b30] transition-all p-1"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Rich Work Log Editor */}
                        <div className="mt-4 p-5 bg-[#f5f5f7] rounded-3xl border border-[#eceef0] shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="flex flex-col gap-4">
                                <div className="flex flex-col sm:flex-row items-center gap-3">
                                    <div className="flex-1 w-full">
                                        <Input 
                                            placeholder="What did you achieve today?"
                                            value={newSubtaskData[task.id]?.name || ''}
                                            onChange={e => {
                                                const name = e.target.value;
                                                setNewSubtaskData(prev => ({
                                                    ...prev,
                                                    [task.id]: {
                                                            ...(prev[task.id] || { 
                                                            name: '', 
                                                            hours: 8, 
                                                            start_time: '09:00', 
                                                            end_time: '17:00', 
                                                            date_logged: new Date().toISOString().split('T')[0] 
                                                        }),
                                                        name
                                                    }
                                                }));
                                            }}
                                            onKeyDown={e => e.key === 'Enter' && handleAddSubtask(task.id)}
                                            className="h-10 text-[11px] font-bold w-full bg-white border-none shadow-none ring-1 ring-[#eceef0]"
                                        />
                                    </div>
                                    <div className="w-full sm:w-36">
                                        <Input 
                                            type="date"
                                            value={newSubtaskData[task.id]?.date_logged || (mounted ? new Date().toISOString().split('T')[0] : '')}
                                            onChange={e => {
                                                const date = e.target.value;
                                                setNewSubtaskData(prev => ({
                                                    ...prev,
                                                    [task.id]: {
                                                        ...(prev[task.id] || { name: '', hours: 8, start_time: '09:00', end_time: '17:00', date_logged: new Date().toISOString().split('T')[0] }),
                                                        date_logged: date
                                                    }
                                                }));
                                            }}
                                            className="h-10 text-[10px] font-bold w-full bg-white border-none shadow-none ring-1 ring-[#eceef0]"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-center gap-3">
                                    <div className="flex-1 w-full flex items-center gap-3 bg-white px-4 py-1.5 rounded-xl border border-[#eceef0]">
                                        <div className="flex-1 flex flex-col min-w-0">
                                            <span className="text-[8px] font-black text-[#86868b] uppercase tracking-widest">Start Time</span>
                                            <Input 
                                                type="time"
                                                value={newSubtaskData[task.id]?.start_time || '09:00'}
                                                onChange={e => {
                                                    const start_time = e.target.value;
                                                    setNewSubtaskData(prev => {
                                                        const current = prev[task.id] || { name: '', hours: 8, start_time: '09:00', end_time: '17:00', date_logged: new Date().toISOString().split('T')[0] };
                                                        const start = start_time.split(':').map(Number);
                                                        const end = current.end_time.split(':').map(Number);
                                                        let diff = (end[0] + end[1] / 60) - (start[0] + start[1] / 60);
                                                        if (diff < 0) diff += 24;
                                                        return { ...prev, [task.id]: { ...current, start_time, hours: Number(diff.toFixed(2)) } };
                                                    });
                                                }}
                                                className="h-6 border-none p-0 text-[11px] font-black focus-visible:ring-0 tabular-nums"
                                            />
                                        </div>
                                        <div className="text-[#eceef0]">→</div>
                                        <div className="flex-1 flex flex-col min-w-0">
                                            <span className="text-[8px] font-black text-[#86868b] uppercase tracking-widest">End Time</span>
                                            <Input 
                                                type="time"
                                                value={newSubtaskData[task.id]?.end_time || '17:00'}
                                                onChange={e => {
                                                    const end_time = e.target.value;
                                                    setNewSubtaskData(prev => {
                                                        const current = prev[task.id] || { name: '', hours: 8, start_time: '09:00', end_time: '17:00', date_logged: new Date().toISOString().split('T')[0] };
                                                        const start = current.start_time.split(':').map(Number);
                                                        const end = end_time.split(':').map(Number);
                                                        let diff = (end[0] + end[1] / 60) - (start[0] + start[1] / 60);
                                                        if (diff < 0) diff += 24;
                                                        return { ...prev, [task.id]: { ...current, end_time, hours: Number(diff.toFixed(2)) } };
                                                    });
                                                }}
                                                className="h-6 border-none p-0 text-[11px] font-black focus-visible:ring-0 tabular-nums"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 bg-white px-4 rounded-xl border border-[#eceef0] h-12 w-full sm:w-auto">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[8px] font-black text-[#86868b] uppercase tracking-widest">LOGGED</span>
                                            <div className="text-sm font-black text-[#0071e3] tabular-nums">
                                                {newSubtaskData[task.id]?.hours || 0}
                                                <span className="ml-1 text-[8px] uppercase">Hrs</span>
                                            </div>
                                        </div>
                                        {activeTimers[`new-${task.id}`] ? (
                                            <button 
                                                onClick={() => handleStopTimer(`new-${task.id}`, task.id)}
                                                className="h-8 px-4 bg-[#ff3b30] text-white text-[9px] font-black rounded-lg hover:bg-[#e03126] transition-all flex items-center gap-2 animate-pulse shadow-lg shadow-[#ff3b30]/20"
                                            >
                                                <div className="w-1 h-1 bg-white rounded-full animate-ping"></div>
                                                STOP ({formatElapsed(activeTimers[`new-${task.id}`])})
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleStartTimer(`new-${task.id}`, task.id)}
                                                className="h-8 px-4 bg-[#f5f5f7] text-[#1d1d1f] text-[9px] font-black rounded-lg hover:bg-[#e5e5ea] transition-all flex items-center gap-2"
                                            >
                                                <Clock size={12} />
                                                TIMER
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => handleAddSubtask(task.id)}
                                            className="h-8 px-4 bg-[#0071e3] text-white text-[9px] font-black rounded-lg hover:bg-[#005bb7] transition-all shadow-sm hover:shadow-lg shadow-[#0071e3]/20"
                                        >
                                            LOG WORK
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Card>
    );

    return (
        <div className="flex flex-col xl:flex-row gap-10 fade-in">
            {/* Left Column: Quick Actions & Log */}
            <div className="xl:w-96 shrink-0 space-y-8">
                <div className="space-y-6">
                    <h3 className="text-xl font-black text-[#1d1d1f] tracking-tight">Focus & Performance</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="p-6 rounded-[32px] border-[#eceef0] bg-[#f5f5f7] shadow-sm flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 rounded-2xl bg-[#0071e3]/10 flex items-center justify-center text-[#0071e3] mb-3">
                                <Zap size={24} strokeWidth={2.5} />
                            </div>
                            <span className="text-[10px] font-black text-[#86868b] uppercase tracking-widest mb-1">Efficiency</span>
                            <span className="text-2xl font-black text-[#1d1d1f]">{Math.round((myCompletedTasks.length / (myActiveTasks.length + myCompletedTasks.length || 1)) * 100)}%</span>
                        </Card>
                        <Card className="p-6 rounded-[32px] border-[#eceef0] bg-white shadow-sm flex flex-col items-center justify-center text-center">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-3">
                                <Plus size={24} strokeWidth={2.5} />
                            </div>
                            <span className="text-[10px] font-black text-[#86868b] uppercase tracking-widest mb-1">Done Today</span>
                            <span className="text-2xl font-black text-[#1d1d1f]">{myCompletedTasks.length}</span>
                        </Card>
                    </div>
                </div>

                <Card className="p-8 rounded-[40px] border-[#eceef0] bg-white shadow-2xl shadow-slate-200/50 xl:sticky xl:top-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 bg-[#1d1d1f] rounded-[24px] flex items-center justify-center text-white shadow-lg">
                            <Clock size={28} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-[#1d1d1f] tracking-tight">Quick Log</h3>
                            <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest leading-none mt-1">Instant work tracking</p>
                        </div>
                    </div>

                    <form onSubmit={handleLogSubmit} className="space-y-6">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Activity Description</label>
                            <input 
                                required 
                                value={logForm.name} 
                                onChange={e => setLogForm({ ...logForm, name: e.target.value })} 
                                placeholder="What are you working on?" 
                                className="w-full h-14 rounded-2xl bg-[#f5f5f7] border-none px-6 text-[13px] font-bold outline-none focus:ring-2 ring-[#0071e3]/20 transition-all placeholder:text-[#86868b]/50" 
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Project Context</label>
                            <Select 
                                value={logForm.project_id} 
                                onChange={e => setLogForm({ ...logForm, project_id: e.target.value })} 
                                className="w-full h-14 rounded-2xl bg-[#f5f5f7] border-none px-6 text-[11px] font-bold outline-none transition-all"
                            >
                                <option value="">Select Project (Optional)</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Priority</label>
                                <Select 
                                    value={logForm.priority} 
                                    onChange={e => setLogForm({ ...logForm, priority: e.target.value as Priority })} 
                                    className="w-full h-14 rounded-2xl bg-[#f5f5f7] border-none px-6 text-[11px] font-bold outline-none transition-all"
                                >
                                    <option value="Low">Low</option>
                                    <option value="Medium">Medium</option>
                                    <option value="High">High</option>
                                    <option value="Urgent">Urgent</option>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Status</label>
                                <Select 
                                    value={logForm.status} 
                                    onChange={e => setLogForm({ ...logForm, status: e.target.value as Status })} 
                                    className="w-full h-14 rounded-2xl bg-[#f5f5f7] border-none px-6 text-[11px] font-bold outline-none transition-all"
                                >
                                    <option value="To Do">To Do</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="In Review">In Review</option>
                                    <option value="Blocked">Blocked</option>
                                    <option value="Completed">Completed</option>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Notes</label>
                            <textarea 
                                value={logForm.notes} 
                                onChange={e => setLogForm({ ...logForm, notes: e.target.value })} 
                                placeholder="Add some details..." 
                                className="w-full h-24 rounded-2xl bg-[#f5f5f7] border-none p-5 text-[11px] font-bold outline-none focus:ring-2 ring-[#0071e3]/20 transition-all resize-none placeholder:text-[#86868b]/50" 
                            />
                        </div>

                        {logError && <p className="text-[10px] font-bold text-[#ff3b30] px-4">{logError}</p>}
                        
                        <button 
                            type="submit" 
                            disabled={isSavingLog} 
                            className="w-full h-12 rounded-2xl bg-[#1d1d1f] text-white font-black tracking-[0.1em] text-[10px] shadow-xl shadow-black/10 hover:translate-y-[-2px] hover:shadow-2xl hover:shadow-black/20 transition-all active:translate-y-0 disabled:opacity-50"
                        >
                            {isSavingLog ? 'LOGGING...' : 'CREATE & LOG ACTIVITY'}
                        </button>
                    </form>
                </Card>
            </div>

            {/* Right: Personal Tasks List */}
            <div className="flex-1 space-y-10">
                {/* Active Tasks */}
                <div>
                    <div className="flex items-center justify-between mb-6 px-4">
                        <div className="flex items-center gap-3">
                            <h3 className="text-sm font-black text-[#1d1d1f] uppercase tracking-widest">Active Workspace</h3>
                            <Badge className="bg-[#0071e3]/10 text-[#0071e3] border-none px-2.5 rounded-full font-bold text-[9px]">
                                {myActiveTasks.length} ACTIVE
                            </Badge>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {myActiveTasks.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[32px] border-2 border-dashed border-[#eceef0]">
                                <div className="text-4xl mb-4">🎈</div>
                                <p className="text-[11px] font-black text-[#86868b] uppercase tracking-widest">No active tasks found</p>
                            </div>
                        ) : (
                            myActiveTasks.map(renderTaskCard)
                        )}
                    </div>
                </div>

                {/* Completed Tasks */}
                {myCompletedTasks.length > 0 && (
                    <div className="pt-10 border-t border-[#eceef0]">
                        <div className="flex items-center justify-between mb-6 px-4">
                            <div className="flex items-center gap-3">
                                <h3 className="text-sm font-black text-[#86868b] uppercase tracking-widest">Completion History</h3>
                                <Badge className="bg-[#f5f5f7] text-[#86868b] border-none px-2.5 rounded-full font-bold text-[9px]">
                                    {myCompletedTasks.length} DONE
                                </Badge>
                            </div>
                        </div>
                        <div className="opacity-75 grayscale-[0.2] hover:opacity-100 hover:grayscale-0 transition-all duration-500 space-y-4">
                            {myCompletedTasks.map(renderTaskCard)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
