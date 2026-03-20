import React from 'react';
import { Card, Button } from './components';
import { Task, Subtask, Status, Profile, Priority } from '@/app/actions/actions';
import { X } from 'lucide-react';
import { TaskDetailsView } from './TaskDetailsView';

interface TaskDetailsModalProps {
    task: Task;
    subtasks: Subtask[];
    employees: Profile[];
    onClose: () => void;
    onUpdateStatus: (taskId: string, status: Status) => Promise<void>;
    onUpdatePriority: (taskId: string, priority: Priority) => Promise<void>;
    onDeleteTask?: (taskId: string, taskName: string) => void;
    isEditable?: boolean;
    currentUserId: string;
    isManager?: boolean;
    refreshData: () => void;
    onAddSubtask: (taskId: string, name: string, hours: number, date: string, startTime: string, endTime: string) => Promise<void>;
    onDeleteSubtask: (taskId: string, subtaskId: string, subtaskName: string) => Promise<void>;
}

export function TaskDetailsModal({ 
    task, 
    subtasks, 
    employees, 
    onClose, 
    onUpdateStatus, 
    onUpdatePriority,
    onDeleteTask,
    isEditable = true,
    currentUserId,
    isManager = false,
    refreshData,
    onAddSubtask,
    onDeleteSubtask
}: TaskDetailsModalProps) {
    // Prevent background scrolling when modal is open
    React.useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12">
            {/* Backdrop with premium blur */}
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300"
                onClick={onClose}
            />
            
            {/* Modal Container */}
            <Card className="w-full max-w-6xl h-full max-h-[94vh] overflow-hidden flex flex-col p-0 shadow-[0_40px_100px_rgba(0,0,0,0.25)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 border-none bg-white rounded-[32px] relative">
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-8 right-8 w-11 h-11 rounded-xl bg-white/80 backdrop-blur-md border border-slate-100 shadow-sm hover:shadow-md flex items-center justify-center transition-all text-slate-400 hover:text-red-500 z-30 group"
                >
                    <X size={18} strokeWidth={2.5} className="group-hover:scale-110 transition-transform" />
                </button>
 
                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar h-full bg-white">
                    <TaskDetailsView 
                        task={task}
                        subtasks={subtasks}
                        employees={employees}
                        onUpdateStatus={onUpdateStatus}
                        onUpdatePriority={onUpdatePriority}
                        onDeleteTask={onDeleteTask}
                        isEditable={isEditable}
                        currentUserId={currentUserId}
                        isManager={isManager}
                        refreshData={refreshData}
                        onAddSubtask={onAddSubtask}
                        onDeleteSubtask={onDeleteSubtask}
                    />
                </div>
 
                {/* Minimalist Footer */}
                <div className="px-10 py-6 border-t border-slate-50 bg-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#34c759] shadow-[0_0_8px_rgba(52,199,89,0.5)]"></div>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Live synchronization active</span>
                    </div>
                    <Button 
                        onClick={onClose}
                        variant="ghost"
                        className="h-11 px-8 rounded-xl font-bold text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all"
                    >
                        Close Portal
                    </Button>
                </div>
            </Card>
        </div>
    );
}
