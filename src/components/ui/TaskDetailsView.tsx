import React from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, Button, Badge, Select, Input } from './components';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { 
    Task, 
    Subtask, 
    Priority, 
    Status, 
    Comment, 
    getComments, 
    saveComment, 
    deleteComment, 
    updateTask, 
    Profile, 
    ActivityLog, 
    getActivityLogs, 
    Attachment, 
    getAttachments, 
    uploadAttachment, 
    deleteAttachment,
    getTaskDetailsData,
    updateSubtask
} from '@/app/actions/actions';
import { 
    Trash2, 
    MessageSquare, 
    Clock, 
    Users, 
    Calendar, 
    X, 
    ExternalLink, 
    Pencil as PencilIcon, 
    Save, 
    History, 
    CheckCircle2, 
    PlusCircle, 
    Paperclip, 
    Upload,
    Timer,
    Info,
    LayoutDashboard,
    ChevronRight,
    Zap
} from 'lucide-react';

import { AIBreakdownButton } from '@/components/features/AIBreakdownModal';
import { TimeTrackerButton } from '@/components/features/TimeTrackerButton';
import { TaskComments } from '@/components/features/TaskComments';

interface TaskDetailsViewProps {
    task: Task;
    subtasks: Subtask[];
    employees: Profile[];
    onUpdateStatus: (taskId: string, status: Status) => Promise<void>;
    onUpdatePriority: (taskId: string, priority: Priority) => Promise<void>;
    onDeleteTask?: (taskId: string, taskName: string) => void;
    isEditable?: boolean;
    currentUserId: string;
    isManager?: boolean;
    refreshData: () => void;
    onAddSubtask: (taskId: string, name: string, hours: number, date: string, startTime: string, endTime: string) => Promise<void>;
    onDeleteSubtask: (taskId: string, subtaskId: string, subtaskName: string) => Promise<void>;
    activeTimers?: Record<string, string>;
    onStartTimer?: (subtaskId: string, taskId: string) => void;
    onStopTimer?: (subtaskId: string, taskId: string) => string | undefined | void | Promise<string | undefined | void>;
    orgId: string;
}

export function TaskDetailsView({ 
    task, 
    subtasks, 
    employees, 
    onUpdateStatus, 
    onUpdatePriority,
    onDeleteTask,
    isEditable = true,
    currentUserId,
    isManager = false,
    refreshData,
    onAddSubtask,
    onDeleteSubtask,
    activeTimers = {},
    onStartTimer,
    onStopTimer,
    orgId
}: TaskDetailsViewProps) {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);
    const [isEditing, setIsEditing] = React.useState(false);
    const [editData, setEditData] = React.useState({
        name: task.name,
        notes: task.notes,
        priority: task.priority,
        start_date: task.start_date,
        deadline: task.deadline,
        assignee_ids: task.assignee_ids || []
    });
    const [comments, setComments] = React.useState<Comment[]>([]);
    const [attachments, setAttachments] = React.useState<Attachment[]>([]);
    const [activityLogs, setActivityLogs] = React.useState<ActivityLog[]>([]);
    const [newComment, setNewComment] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [isCommenting, setIsCommenting] = React.useState(false);
    const [isUploading, setIsUploading] = React.useState(false);
    const [isAddingSubtask, setIsAddingSubtask] = React.useState(false);
    const [isUpdatingSubtask, setIsUpdatingSubtask] = React.useState(false);
    const [editingSubtaskId, setEditingSubtaskId] = React.useState<string | null>(null);
    const [subtaskToDelete, setSubtaskToDelete] = React.useState<Subtask | null>(null);
    const [commentToDelete, setCommentToDelete] = React.useState<string | null>(null);
    const [isDragging, setIsDragging] = React.useState(false);
    const [activeTimerStart, setActiveTimerStart] = React.useState<number | null>(null);
    const [elapsed, setElapsed] = React.useState(0);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [subtaskForm, setSubtaskForm] = React.useState({
        name: '',
        hours: 0,
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '17:00'
    });

    const [editSubtaskForm, setEditSubtaskForm] = React.useState({
        name: '',
        hours: 0,
        date: '',
        startTime: '',
        endTime: ''
    });

    React.useEffect(() => {
        if (task.id) {
            loadAllData();
        }
    }, [task.id]);

    React.useEffect(() => {
        let interval: any;
        if (activeTimerStart) {
            interval = setInterval(() => {
                setElapsed(Date.now() - activeTimerStart);
            }, 1000);
        } else {
            setElapsed(0);
        }
        return () => clearInterval(interval);
    }, [activeTimerStart]);

    const startTimer = () => {
        setActiveTimerStart(Date.now());
    };

    const stopTimer = () => {
        if (!activeTimerStart) return;
        const totalMs = Date.now() - activeTimerStart;
        const totalHours = Math.round((totalMs / (1000 * 60 * 60)) * 100) / 100;
        
        const now = new Date();
        const startTimeStr = new Date(activeTimerStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const endTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

        setSubtaskForm(prev => ({ 
            ...prev, 
            hours: totalHours,
            startTime: startTimeStr,
            endTime: endTimeStr
        }));
        setActiveTimerStart(null);
    };

    const loadAllData = async () => {
        try {
            const data = await getTaskDetailsData(task.id);
            setComments(data.comments);
            setAttachments(data.attachments);
            setActivityLogs(data.activityLogs);
        } catch (err) {
            console.error("Failed to load bulk task details:", err);
        }
    };

    const handleSaveEdit = async () => {
        setIsSaving(true);
        try {
            await updateTask(task.id, editData);
            setIsEditing(false);
            refreshData();
            loadAllData();
            toast.success("Task updated successfully.");
        } catch (err) {
            toast.error("Failed to update task.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddComment = async () => {
        if (!newComment.trim()) return;
        setIsCommenting(true);
        try {
            await saveComment({
                task_id: task.id,
                author_id: currentUserId,
                content: newComment
            });
            setNewComment('');
            loadAllData();
        } catch (err) {
            toast.error("Failed to post comment.");
        } finally {
            setIsCommenting(false);
        }
    };

    const handleDeleteComment = async (commentId: string) => {
        try {
            await deleteComment(commentId);
            loadAllData();
        } catch (err) {
            toast.error("Failed to delete comment.");
        }
    };

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setIsUploading(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('taskId', task.id);
                formData.append('uploaderId', currentUserId);
                
                await uploadAttachment(formData);
            }
            loadAllData();
            toast.success("Files uploaded successfully.");
        } catch (err) {
            toast.error("Failed to upload files.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDeleteAttachment = async (id: string) => {
        try {
            await deleteAttachment(id, task.id);
            loadAllData();
        } catch (err) {
            toast.error("Failed to delete attachment.");
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileUpload(e.dataTransfer.files);
    };



    const handleAddSubtask = async () => {
        if (!subtaskForm.name.trim() || subtaskForm.hours <= 0) return;
        setIsAddingSubtask(true);
        try {
            await onAddSubtask(task.id, subtaskForm.name, subtaskForm.hours, subtaskForm.date, subtaskForm.startTime, subtaskForm.endTime);
            setSubtaskForm({ 
                name: '', 
                hours: 0, 
                date: new Date().toISOString().split('T')[0],
                startTime: '09:00',
                endTime: '17:00'
            });
            loadAllData();
        } finally {
            setIsAddingSubtask(false);
        }
    };

    const handleUpdateSubtask = async (subtaskId: string) => {
        if (!editSubtaskForm.name.trim() || editSubtaskForm.hours <= 0) return;
        setIsUpdatingSubtask(true);
        try {
            await updateSubtask({
                id: subtaskId,
                task_id: task.id,
                name: editSubtaskForm.name,
                hours_spent: editSubtaskForm.hours,
                date_logged: editSubtaskForm.date,
                start_time: editSubtaskForm.startTime,
                end_time: editSubtaskForm.endTime
            });
            setEditingSubtaskId(null);
            refreshData();
            loadAllData();
        } catch (err) {
            toast.error("Failed to update work log.");
        } finally {
            setIsUpdatingSubtask(false);
        }
    };

    if (!mounted) return null;

    return (
        <div className="flex flex-col h-full bg-white max-w-5xl mx-auto custom-scrollbar">
            {/* --- HEADER --- */}
            <div className="px-10 pt-10 pb-6 bg-white sticky top-0 z-20">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[#0051e6] shadow-sm">
                            <LayoutDashboard size={22} strokeWidth={2} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">TASK ID {task.id.slice(0, 8)}</span>
                                <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                                <Badge variant={task.priority} className="text-[8px] px-2 py-0.5 font-bold uppercase tracking-widest rounded-lg">{task.priority}</Badge>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1 leading-tight">{task.name}</h2>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <AIBreakdownButton
                            taskId={task.id}
                            taskName={task.name}
                            taskNotes={task.notes}
                            onAccept={async (subtasks) => {
                                for (const s of subtasks) {
                                    await onAddSubtask(task.id, s.name, s.estimated_hours, new Date().toISOString().split('T')[0], '09:00', '17:00');
                                }
                                refreshData();
                                loadAllData();
                            }}
                        />
                        
                        {(isManager || isEditable) && (
                            <button 
                                onClick={() => setIsEditing(!isEditing)}
                                className={`h-11 px-5 rounded-xl flex items-center gap-2.5 transition-all font-bold text-[10px] uppercase tracking-widest shadow-sm ${isEditing ? 'bg-red-500 text-white shadow-red-100' : 'bg-white border border-slate-100 hover:bg-slate-50 text-slate-800'}`}
                            >
                                {isEditing ? <X size={14} strokeWidth={2.5} /> : <PencilIcon size={14} strokeWidth={2.5} />}
                                {isEditing ? "Cancel" : "Edit"}
                            </button>
                        )}
                    </div>
                </div>
                <div className="h-[1px] bg-slate-100 w-full" />
            </div>

            {/* --- CONTENT GRID --- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 overflow-y-auto custom-scrollbar flex-1">
                <div className="lg:col-span-8 px-10 py-8 space-y-12">
                    <section>
                        {isEditing ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">Task Name</label>
                                    <Input value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="h-12 rounded-xl bg-slate-50 border-slate-200 px-5 text-lg font-bold tracking-tight focus:bg-white transition-all" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">Notes</label>
                                    <textarea value={editData.notes} onChange={e => setEditData({...editData, notes: e.target.value})} className="w-full min-h-[140px] rounded-[20px] bg-slate-50 border border-slate-200 p-5 text-sm font-medium resize-none focus:bg-white transition-all outline-none" />
                                </div>
                                <Button onClick={handleSaveEdit} disabled={isSaving} className="w-full h-12 rounded-xl bg-[#0051e6] hover:bg-[#0077ed] text-white font-bold tracking-widest text-[10px] uppercase">
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    <Info size={14} className="text-[#0051e6]" strokeWidth={2.5} />
                                    <span>Description</span>
                                </h3>
                                <div className="bg-slate-50/50 p-6 rounded-[24px] border border-slate-100">
                                    <p className="text-slate-600 text-[13px] leading-relaxed font-medium">
                                        {task.notes || <span className="text-slate-300 italic">No description provided.</span>}
                                    </p>
                                </div>
                            </div>
                        )}
                    </section>

                    <section>
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                <Timer size={14} className="text-[#0051e6]" strokeWidth={2.5} />
                                <span>Work Logs & Time Tracking</span>
                            </h3>
                            <TimeTrackerButton taskId={task.id} runningEntry={null} totalHours={subtasks.reduce((a, s) => a + (s.hours_spent || 0), 0)} />
                        </div>

                        {(isManager || task.employee_id === currentUserId || task.assignee_ids?.includes(currentUserId)) && (
                            <div className="p-6 bg-slate-50/50 rounded-[24px] border border-slate-100 mb-8 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="md:col-span-3">
                                        <Input placeholder="New daily activity..." value={subtaskForm.name} onChange={e => setSubtaskForm({...subtaskForm, name: e.target.value})} className="h-12 bg-white border-slate-200 rounded-xl px-4 text-sm font-medium" />
                                    </div>
                                    <Input type="date" value={subtaskForm.date} onChange={e => setSubtaskForm({...subtaskForm, date: e.target.value})} className="h-12 bg-white border-slate-200 rounded-xl px-4 text-[13px] font-medium" />
                                </div>
                                <div className="flex gap-4">
                                    <Button onClick={handleAddSubtask} disabled={isAddingSubtask || !subtaskForm.name.trim()} className="w-full h-11 bg-[#0051e6] text-white rounded-2xl font-black text-[9px] uppercase tracking-widest">
                                        {isAddingSubtask ? 'Logging...' : 'Upload Work Log'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3">
                            {subtasks.sort((a,b) => new Date(b.date_logged || '').getTime() - new Date(a.date_logged || '').getTime()).map((sub) => (
                                <div key={sub.id} className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center justify-between hover:border-[#0051e6] transition-all">
                                    <div>
                                        <p className="text-[12px] font-bold text-slate-800">{sub.name}</p>
                                        <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-1">{sub.date_logged} • {sub.hours_spent} hrs</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="pt-8 border-t border-slate-100">
                        <TaskComments taskId={task.id} orgId={orgId} currentUserId={currentUserId} initialComments={[]} initialReactions={[]} />
                    </section>
                </div>

                <div className="lg:col-span-4 bg-slate-50/30 border-l border-slate-100 p-8 space-y-6">
                    <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-6">
                        <div className="space-y-3">
                            <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <CheckCircle2 size={12} className="text-[#34c759]" />
                                <span>Status</span>
                            </h4>
                            <Select value={task.status} onChange={(e) => onUpdateStatus(task.id, e.target.value as Status)}>
                                <option value="To Do">To Do</option>
                                <option value="In Progress">In Progress</option>
                                <option value="In Review">In Review</option>
                                <option value="Completed">Completed</option>
                            </Select>
                        </div>
                    </div>
                </div>
            </div>


        </div>
    );
}
