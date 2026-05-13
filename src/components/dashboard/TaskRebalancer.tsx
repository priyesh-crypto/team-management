"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Zap, 
    X, 
    ArrowRight, 
    UserPlus, 
    AlertTriangle,
    CheckCircle2,
    Clock,
    ChevronRight
} from 'lucide-react';
import { Task, Profile } from '@/app/actions/actions';
import { updateTaskStatus, updateTaskAssignee } from '@/app/actions/actions';
import { toast } from 'sonner';

interface RebalanceTask extends Task {
    suggestedAssignee?: Profile;
    confidence: number;
}

interface Props {
    tasks: Task[];
    employees: Profile[];
    onClose: () => void;
    memberId: string | null;
    memberName: string | null;
    onRebalanceComplete: () => void;
}

export default function TaskRebalancer({ tasks, employees, onClose, memberId, memberName, onRebalanceComplete }: Props) {
    const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
    const [isRebalancing, setIsRebalancing] = useState(false);

    // Calculate risk scores for everyone to find the best alternative assignees
    const employeeRiskScores = useMemo(() => {
        return employees.map(e => {
            const mt = tasks.filter(t => t.employee_id === e.id && t.status !== 'Blocked');
            const active = mt.filter(t => t.status !== 'Completed');
            const overdue = mt.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'Completed').length;
            const urgent = active.filter(t => t.priority === 'Urgent' || t.priority === 'High').length;
            const score = (overdue * 3) + active.length + (urgent * 2);
            return { id: e.id, score, name: e.name, profile: e };
        }).sort((a, b) => a.score - b.score);
    }, [tasks, employees]);

    const overloadedTasks = useMemo(() => {
        if (!memberId) return [];
        return tasks.filter(t => t.employee_id === memberId && t.status !== 'Completed' && t.status !== 'Blocked')
            .map(t => {
                // Suggest the employee with the lowest risk score who isn't the current owner
                const suggestion = employeeRiskScores.find(s => s.id !== memberId);
                return {
                    ...t,
                    suggestedAssignee: suggestion?.profile,
                    confidence: suggestion ? Math.max(0, 100 - (suggestion.score * 5)) : 0
                } as RebalanceTask;
            })
            .sort((a, b) => {
                // Prioritize overdue and urgent tasks for rebalancing
                if (a.status === 'Overdue') return -1;
                if (b.status === 'Overdue') return 1;
                if (a.priority === 'Urgent') return -1;
                return 1;
            });
    }, [tasks, memberId, employeeRiskScores]);

    const handleRebalance = async () => {
        if (selectedTaskIds.length === 0) return;
        setIsRebalancing(true);
        try {
            for (const taskId of selectedTaskIds) {
                const task = overloadedTasks.find(t => t.id === taskId);
                if (task?.suggestedAssignee) {
                    await updateTaskAssignee(taskId, task.suggestedAssignee.id);
                }
            }
            toast.success(`Successfully rebalanced ${selectedTaskIds.length} tasks.`);
            onRebalanceComplete();
            onClose();
        } catch (err) {
            toast.error("Failed to rebalance tasks.");
        } finally {
            setIsRebalancing(false);
        }
    };

    if (!memberId) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="p-8 pb-4 flex items-start justify-between border-b border-[#f0f0f2]">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-8 h-8 rounded-xl bg-[#0051e6]/10 flex items-center justify-center text-[#0051e6]">
                                    <Zap size={16} fill="currentColor" />
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-widest text-[#0051e6]">AI Smart Rebalancer</span>
                            </div>
                            <h2 className="text-2xl font-black text-[#1d1d1f] tracking-tight">
                                Optimize Load for {memberName}
                            </h2>
                            <p className="text-sm text-[#86868b] mt-1">
                                AI has identified {overloadedTasks.length} tasks that could be reassigned to prevent burnout.
                            </p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-[#f5f5f7] rounded-full transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-8 pt-6 custom-scrollbar">
                        <div className="space-y-4">
                            {overloadedTasks.map((task) => (
                                <div 
                                    key={task.id}
                                    className={`group p-4 rounded-2xl border transition-all cursor-pointer ${selectedTaskIds.includes(task.id) ? 'border-[#0051e6] bg-[#0051e6]/[0.02] shadow-sm' : 'border-[#e5e5ea] hover:border-[#0051e6]/30'}`}
                                    onClick={() => {
                                        setSelectedTaskIds(prev => 
                                            prev.includes(task.id) ? prev.filter(id => id !== task.id) : [...prev, task.id]
                                        );
                                    }}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${selectedTaskIds.includes(task.id) ? 'bg-[#0051e6] border-[#0051e6] text-white' : 'border-[#d1d1d6] group-hover:border-[#0051e6]'}`}>
                                                {selectedTaskIds.includes(task.id) && <CheckCircle2 size={12} />}
                                            </div>
                                            <div>
                                                <h4 className="text-[13px] font-bold text-[#1d1d1f]">{task.name}</h4>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${task.priority === 'Urgent' ? 'bg-[#ff3b30]/10 text-[#ff3b30]' : 'bg-[#f5f5f7] text-[#86868b]'}`}>
                                                        {task.priority}
                                                    </span>
                                                    {new Date(task.deadline) < new Date() && (
                                                        <span className="text-[9px] font-bold text-[#ff3b30] flex items-center gap-1">
                                                            <Clock size={8} /> Overdue
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="text-[9px] text-[#86868b] uppercase font-black tracking-widest mb-1">Suggested Reassignment</p>
                                                <div className="flex items-center gap-2 justify-end">
                                                    <span className="text-[11px] font-bold text-[#1d1d1f]">{task.suggestedAssignee?.name}</span>
                                                    <div className="w-6 h-6 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center text-[8px] font-black">
                                                        {task.suggestedAssignee?.name.charAt(0)}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 p-2 bg-[#f5f5f7] rounded-xl">
                                        <div className="flex-1 h-1.5 bg-[#e5e5ea] rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-[#22be66] rounded-full"
                                                style={{ width: `${task.confidence}%` }}
                                            />
                                        </div>
                                        <span className="text-[9px] font-black text-[#22be66] uppercase">{task.confidence}% AI Confidence</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-8 pt-4 border-t border-[#f0f0f2] flex items-center justify-between bg-[#f8f9fb]">
                        <div className="text-[11px] text-[#86868b]">
                            <span className="font-bold text-[#1d1d1f]">{selectedTaskIds.length}</span> tasks selected for optimization
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-[#1d1d1f] hover:bg-[#e5e5ea] transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleRebalance}
                                disabled={selectedTaskIds.length === 0 || isRebalancing}
                                className={`px-8 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all flex items-center gap-2 ${selectedTaskIds.length > 0 ? 'bg-[#0051e6] hover:shadow-lg hover:translate-y-[-2px]' : 'bg-[#d1d1d6] cursor-not-allowed'}`}
                            >
                                {isRebalancing ? 'Optimizing...' : 'Apply Optimization'}
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
