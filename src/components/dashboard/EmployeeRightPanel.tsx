"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { Card, Button, Input, Select } from '@/components/ui/components';
import { Project, Priority, Status } from '@/app/actions/actions';

const CircularProgress = ({ percentage, color = '#0071e3', size = 160, strokeWidth = 12 }: { percentage: number, color?: string, size?: number, strokeWidth?: number }) => {
    const radius = Math.max(0, (size - strokeWidth) / 2);
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center group" style={{ width: size, height: size }}>
            <div className="absolute inset-0 bg-[#0071e3]/5 rounded-full blur-[40px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            <svg className="transform -rotate-90 relative z-10" width={size} height={size}>
                <circle
                    className="text-[#f5f5f7]"
                    strokeWidth={strokeWidth}
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <motion.circle
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 2, ease: "circOut" }}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    stroke={color}
                    strokeLinecap="round"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    className="drop-shadow-[0_0_8px_rgba(0,113,227,0.3)]"
                />
            </svg>
            <div className="absolute flex flex-col items-center z-10">
                <motion.span 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl font-black text-[#1d1d1f] tracking-tighter"
                >
                    {Math.round(percentage)}%
                </motion.span>
                <span className="text-[10px] font-black text-[#86868b] uppercase tracking-[0.2em] mt-1">Focus</span>
            </div>
        </div>
    );
};

interface EmployeeRightPanelProps {
    efficiencyPercentage: number;
    totalTasksCount: number;
    completedTasksCount: number;
    formData: {
        name: string;
        project_id: string;
        start_date: string;
        deadline: string;
        priority: Priority;
        hours_spent: number;
        status: Status;
        notes: string;
    };
    setFormData: (data: any) => void;
    projects: Project[];
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    loading: boolean;
}

export function EmployeeRightPanel({
    efficiencyPercentage,
    totalTasksCount,
    completedTasksCount,
    formData,
    setFormData,
    projects,
    handleSubmit,
    loading
}: EmployeeRightPanelProps) {
    return (
        <aside className="w-72 overflow-y-auto hidden xl:block border-l border-slate-100 bg-white p-5 custom-scrollbar">
            <div className="flex flex-col gap-5">
                <Card className="p-5 flex flex-col items-center bg-slate-50/50 border-slate-100 rounded-[20px] shadow-sm">
                    <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-5">Focus Performance</h4>
                    <CircularProgress percentage={efficiencyPercentage} />
                    <div className="grid grid-cols-2 gap-2 w-full mt-6">
                        <div className="bg-white p-3 rounded-xl flex flex-col items-center border border-slate-100 shadow-sm">
                            <span className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">Total</span>
                            <span className="text-lg font-bold text-slate-800">{totalTasksCount}</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl flex flex-col items-center border border-slate-100 shadow-sm">
                            <span className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">Done</span>
                            <span className="text-lg font-bold text-slate-800">{completedTasksCount}</span>
                        </div>
                    </div>
                </Card>

                <Card className="p-5 border-slate-100/50 bg-white/80 backdrop-blur-xl rounded-[20px] shadow-sm transition-all duration-500 hover:shadow-md">
                    <div className="flex items-center gap-2 mb-5">
                        <div className="w-7 h-7 bg-[#0071e3]/10 rounded-lg flex items-center justify-center text-[#0071e3]">
                            <Plus size={14} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-[9px] font-bold text-slate-800 uppercase tracking-widest">Quick Log</h3>
                            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Instant task creation</p>
                        </div>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Project Context</label>
                            <Select 
                                value={formData.project_id || ''} 
                                onChange={e => setFormData({ ...formData, project_id: e.target.value })} 
                                className="w-full"
                            >
                                <option value="">General Inbox</option>
                                {projects.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Task Definition</label>
                            <Input 
                                required 
                                value={formData.name} 
                                onChange={e => setFormData({ ...formData, name: e.target.value })} 
                                placeholder="e.g., Design Review..." 
                                className="w-full" 
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                                <Input type="date" required value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} className="h-10 text-[10px] font-bold w-full bg-white border-none shadow-none ring-1 ring-[#eceef0]" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                                <Input type="date" required value={formData.deadline} onChange={e => setFormData({ ...formData, deadline: e.target.value })} className="h-10 text-[10px] font-bold w-full bg-white border-none shadow-none ring-1 ring-[#eceef0]" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                                <Select 
                                    value={formData.priority} 
                                    onChange={e => setFormData({ ...formData, priority: e.target.value as Priority })} 
                                    className="w-full"
                                >
                                    <option>Low</option>
                                    <option>Medium</option>
                                    <option>High</option>
                                    <option>Urgent</option>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Schedule</label>
                                <Select 
                                    value={formData.status} 
                                    onChange={e => setFormData({ ...formData, status: e.target.value as Status })} 
                                    className="w-full"
                                >
                                    <option>To Do</option>
                                    <option>In Progress</option>
                                    <option>Blocked</option>
                                    <option>Overdue</option>
                                    <option>Completed</option>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Notes & Context</label>
                            <textarea 
                                value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full h-24 bg-slate-50/50 border border-slate-100 rounded-xl p-4 text-[13px] font-medium resize-none focus:bg-white focus:border-[#0071e3]/30 transition-all outline-none"
                                placeholder="Add any specific details here..."
                            />
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full py-3 text-[10px] shadow-md" 
                            disabled={loading}
                        >
                            {loading ? 'Logging Entry...' : 'Create Task'}
                        </Button>
                    </form>
                </Card>
            </div>
        </aside>
    );
}
