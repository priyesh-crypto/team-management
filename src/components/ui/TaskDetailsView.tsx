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
    onStopTimer
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
    const [commentToDelete, setCommentToDelete] = React.useState<string | null>(null);
    const [isDeleting, setIsDeleting] = React.useState(false);
    const [isUploading, setIsUploading] = React.useState(false);
    const [isDragging, setIsDragging] = React.useState(false);
    const [subtaskForm, setSubtaskForm] = React.useState({
        name: '',
        hours: 0,
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '17:00'
    });
    const [editingSubtaskId, setEditingSubtaskId] = React.useState<string | null>(null);
    const [editSubtaskForm, setEditSubtaskForm] = React.useState({
        name: '',
        hours: 0,
        date: '',
        startTime: '',
        endTime: ''
    });
    const [isAddingSubtask, setIsAddingSubtask] = React.useState(false);
    const [isUpdatingSubtask, setIsUpdatingSubtask] = React.useState(false);
    const [subtaskToDelete, setSubtaskToDelete] = React.useState<{id: string, name: string} | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Timer calculation for the "New Activity" form (temporary/volatile timer for the 'new-' ID)
    const [now, setNow] = React.useState(Date.now());
    React.useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    const activeTimerStart = activeTimers[`new-${task.id}`];
    const elapsed = activeTimerStart ? now - new Date(activeTimerStart).getTime() : 0;

    const startTimer = () => {
        if (!onStartTimer) return;
        const startTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        setSubtaskForm(prev => ({ ...prev, startTime: startTimeStr }));
        onStartTimer(`new-${task.id}`, task.id);
    };

    const stopTimer = async () => {
        if (!onStopTimer) return;
        const result = await onStopTimer(`new-${task.id}`, task.id);
        const endTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        setSubtaskForm(prev => ({ ...prev, endTime: endTimeStr }));
    };

    const formatElapsed = (ms: number) => {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        return `${h}:${(m % 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    };

    const calculateHours = (start: string, end: string) => {
        if (!start || !end || !start.includes(':') || !end.includes(':')) return 0;
        const [sH, sM] = start.split(':').map(Number);
        const [eH, eM] = end.split(':').map(Number);
        
        if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return 0;
        
        const startTotal = sH * 60 + sM;
        const endTotal = eH * 60 + eM;
        let diff = endTotal - startTotal;
        if (diff < 0) diff += 24 * 60; // Handle overnight logs
        return Math.round((diff / 60) * 100) / 100;
    };

    React.useEffect(() => {
        const hours = calculateHours(subtaskForm.startTime, subtaskForm.endTime);
        setSubtaskForm(prev => ({ ...prev, hours }));
    }, [subtaskForm.startTime, subtaskForm.endTime]);

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
            loadActivity();
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
            loadActivity();
        } catch (err) {
            toast.error("Failed to update work log.");
        } finally {
            setIsUpdatingSubtask(false);
        }
    };

    const startEditingSubtask = (sub: Subtask) => {
        setEditingSubtaskId(sub.id);
        setEditSubtaskForm({
            name: sub.name,
            hours: sub.hours_spent || 0,
            date: sub.date_logged || '',
            startTime: sub.start_time || '',
            endTime: sub.end_time || ''
        });
    };

    const confirmDeleteSubtask = async () => {
        if (!subtaskToDelete) return;
        try {
            await onDeleteSubtask(task.id, subtaskToDelete.id, subtaskToDelete.name);
            setSubtaskToDelete(null);
            loadActivity();
        } catch (err) {
            toast.error("Failed to delete work log.");
        }
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

    React.useEffect(() => {
        loadAllData();
        setEditData({
            name: task.name,
            notes: task.notes,
            priority: task.priority,
            start_date: task.start_date,
            deadline: task.deadline,
            assignee_ids: task.assignee_ids || []
        });
    }, [task.id]);

    const loadComments = async () => {
        const data = await getComments(task.id);
        setComments(data);
    };

    const loadAttachments = async () => {
        const data = await getAttachments(task.id);
        setAttachments(data);
    };

    const loadActivity = async () => {
        const data = await getActivityLogs(task.id);
        setActivityLogs(data);
    };

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setIsUploading(true);
        try {
            for (const file of Array.from(files)) {
                if (file.size > 50 * 1024 * 1024) {
                    toast.error(`File "${file.name}" is too large (max 50MB).`);
                    continue;
                }
                const formData = new FormData();
                formData.append('file', file);
                formData.append('taskId', task.id);
                await uploadAttachment(formData);
            }
            loadAttachments();
            loadActivity();
        } catch (err: any) {
            toast.error(err.message || "Failed to upload file.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!confirm("Delete this attachment?")) return;
        try {
            await deleteAttachment(attachmentId, task.id);
            loadAttachments();
            loadActivity();
        } catch (err: any) {
            toast.error(err.message || "Failed to delete attachment.");
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileUpload(e.dataTransfer.files);
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    };

    const handleSaveEdit = async () => {
        setIsSaving(true);
        try {
            if (editData.priority !== task.priority) {
                await onUpdatePriority(task.id, editData.priority);
            }
            await updateTask(task.id, editData);
            setIsEditing(false);
            refreshData();
            loadActivity();
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
            loadComments();
            loadActivity();
        } catch (err) {
            toast.error("Failed to add comment.");
        } finally {
            setIsCommenting(false);
        }
    };

    const handleDeleteComment = async () => {
        if (!commentToDelete) return;
        setIsDeleting(true);
        try {
            await deleteComment(commentToDelete);
            setCommentToDelete(null);
            loadComments();
            loadActivity();
        } catch (err) {
            console.error("Error deleting comment:", err);
            toast.error("Failed to delete comment.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white max-w-5xl mx-auto custom-scrollbar">
            {/* --- HEADER --- */}
            <div className="px-10 pt-10 pb-6 bg-white sticky top-0 z-20">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-[#0c64ef] shadow-sm">
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
                        {(isManager || isEditable) && (
                            <button 
                                onClick={() => setIsEditing(!isEditing)}
                                className={`h-11 px-5 rounded-xl flex items-center gap-2.5 transition-all font-bold text-[10px] uppercase tracking-widest shadow-sm ${isEditing ? 'bg-red-500 text-white shadow-red-100' : 'bg-white border border-slate-100 hover:bg-slate-50 text-slate-800'}`}
                            >
                                {isEditing ? <X size={14} strokeWidth={2.5} /> : <PencilIcon size={14} strokeWidth={2.5} />}
                                {isEditing ? "Cancel" : "Edit"}
                            </button>
                        )}
                        {(isManager || task.employee_id === currentUserId) && onDeleteTask && (
                            <button 
                                onClick={() => onDeleteTask(task.id, task.name)}
                                className="flex items-center justify-center w-11 h-11 bg-white border border-slate-100 text-slate-300 hover:text-red-500 hover:border-red-100 rounded-xl transition-all shadow-sm group"
                            >
                                <Trash2 size={16} strokeWidth={2} className="group-hover:scale-110 transition-transform" />
                            </button>
                        )}
                    </div>
                </div>
                <div className="h-[1px] bg-slate-100 w-full" />
            </div>

            {/* --- CONTENT GRID --- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 overflow-y-auto custom-scrollbar flex-1">
                {/* --- MAIN COLUMN (LEFT) --- */}
                <div className="lg:col-span-8 px-10 py-8 space-y-12">
                    {/* Description Section */}
                    <section>
                        {isEditing ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">Task Name</label>
                                    <Input 
                                        value={editData.name}
                                        onChange={e => setEditData({...editData, name: e.target.value})}
                                        className="h-12 rounded-xl bg-slate-50 border-slate-200 px-5 text-lg font-bold tracking-tight focus:bg-white transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">Notes</label>
                                    <textarea 
                                        value={editData.notes}
                                        onChange={e => setEditData({...editData, notes: e.target.value})}
                                        className="w-full min-h-[140px] rounded-[20px] bg-slate-50 border border-slate-200 p-5 text-sm font-medium resize-none focus:bg-white transition-all outline-none"
                                        placeholder="Describe the task..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">Start Date</label>
                                        <Input 
                                            type="date"
                                            value={editData.start_date ? new Date(editData.start_date).toISOString().split('T')[0] : ''}
                                            onChange={e => setEditData({...editData, start_date: e.target.value})}
                                            className="h-12 rounded-xl bg-slate-50 border-slate-200 px-5 text-sm font-bold focus:bg-white transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">End Date</label>
                                        <Input 
                                            type="date"
                                            value={editData.deadline ? new Date(editData.deadline).toISOString().split('T')[0] : ''}
                                            onChange={e => setEditData({...editData, deadline: e.target.value})}
                                            className="h-12 rounded-xl bg-slate-50 border-slate-200 px-5 text-sm font-bold focus:bg-white transition-all"
                                        />
                                    </div>
                                </div>
                                <Button onClick={handleSaveEdit} disabled={isSaving} className="w-full h-12 rounded-xl bg-[#0c64ef] hover:bg-[#0077ed] text-white font-bold tracking-widest text-[10px] uppercase shadow-lg shadow-blue-100">
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                    <Info size={14} className="text-[#0c64ef]" strokeWidth={2.5} />
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

                    {/* Work Logs Section */}
                    <section>
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest flex items-center gap-3">
                                <Timer size={14} className="text-[#0c64ef]" strokeWidth={2.5} />
                                <span>Work Logs & Time Tracking</span>
                                <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 rounded-lg">{subtasks.length}</Badge>
                            </h3>
                        </div>
 
                        {/* Log New Activity Form */}
                        {(isManager || task.employee_id === currentUserId || task.assignee_ids?.includes(currentUserId)) && (
                            <div className="p-6 bg-slate-50/50 rounded-[24px] border border-slate-100 mb-8 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="md:col-span-3">
                                        <Input 
                                            placeholder="New daily activity..."
                                            value={subtaskForm.name}
                                            onChange={e => setSubtaskForm({...subtaskForm, name: e.target.value})}
                                            className="h-12 bg-white border-slate-200 rounded-xl px-4 text-sm font-medium focus:bg-white"
                                        />
                                    </div>
                                    <div className="relative">
                                        <Input 
                                            type="date"
                                            value={subtaskForm.date}
                                            onChange={e => setSubtaskForm({...subtaskForm, date: e.target.value})}
                                            className="h-12 bg-white border-slate-200 rounded-xl px-4 text-[13px] font-medium"
                                        />
                                    </div>
                                </div>
 
                                 <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    <div className="md:col-span-8 p-4 bg-white rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm overflow-hidden min-h-[80px]">
                                        <div className="flex items-center gap-6 flex-1 min-w-0">
                                            <div className="flex flex-col min-w-[110px]">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Start</span>
                                                <input 
                                                    type="time" 
                                                    value={subtaskForm.startTime}
                                                    onChange={e => setSubtaskForm({...subtaskForm, startTime: e.target.value})}
                                                    className="text-sm font-bold bg-transparent outline-none w-full min-w-[100px] tabular-nums pr-2"
                                                />
                                            </div>
                                            <ChevronRight size={14} className="text-slate-200 shrink-0" />
                                            <div className="flex flex-col min-w-[110px]">
                                                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">End</span>
                                                <input 
                                                    type="time" 
                                                    value={subtaskForm.endTime}
                                                    onChange={e => setSubtaskForm({...subtaskForm, endTime: e.target.value})}
                                                    className="text-sm font-bold bg-transparent outline-none w-full min-w-[100px] tabular-nums pr-2"
                                                />
                                            </div>
                                        </div>
                                        <div className="h-8 w-[1px] bg-slate-50 mx-4 shrink-0" />
                                        <div className="flex flex-col items-end shrink-0 min-w-[70px]">
                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Total</span>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-base font-black text-[#0c64ef] tabular-nums">{isNaN(subtaskForm.hours) ? '0' : subtaskForm.hours}</span>
                                                <span className="text-[8px] font-black text-[#0c64ef] uppercase tracking-widest">Hrs</span>
                                            </div>
                                        </div>
                                    </div>
 
                                    <div className="md:col-span-4 flex flex-col gap-2">
                                        <button 
                                            onClick={activeTimerStart ? stopTimer : startTimer}
                                            className={cn(
                                                "w-full h-11 rounded-2xl font-black text-[9px] uppercase tracking-[0.1em] flex items-center justify-center gap-3 transition-all shadow-sm active:scale-95",
                                                activeTimerStart 
                                                    ? "bg-red-500 text-white shadow-red-100" 
                                                    : "bg-[#0c64ef] text-white hover:bg-[#0077ed]"
                                            )}
                                        >
                                            <Clock size={16} strokeWidth={3} className={cn(activeTimerStart && "animate-pulse")} />
                                            {activeTimerStart ? `Stop (${formatElapsed(elapsed)})` : "Start Timer"}
                                        </button>
                                        <Button 
                                            onClick={handleAddSubtask} 
                                            disabled={isAddingSubtask || !subtaskForm.name.trim() || subtaskForm.hours <= 0}
                                            className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-black text-[9px] uppercase tracking-[0.1em] transition-all"
                                        >
                                            {isAddingSubtask ? 'Log In Progress...' : 'Upload Work Log'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
 
                        <div className="space-y-3">
                            {subtasks.length > 0 ? (
                                subtasks.sort((a,b) => new Date(b.date_logged || '').getTime() - new Date(a.date_logged || '').getTime()).map((sub) => (
                                    <div key={sub.id} className="group">
                                        {editingSubtaskId === sub.id ? (
                                            <div className="p-6 bg-white rounded-2xl border-2 border-[#0c64ef] space-y-4 animate-in fade-in zoom-in-95 duration-200">
                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                                    <div className="md:col-span-3">
                                                        <Input 
                                                            value={editSubtaskForm.name}
                                                            onChange={e => setEditSubtaskForm({...editSubtaskForm, name: e.target.value})}
                                                            className="h-10 bg-slate-50 border-slate-200 rounded-xl px-4 text-sm font-medium"
                                                        />
                                                    </div>
                                                    <Input 
                                                        type="date"
                                                        value={editSubtaskForm.date}
                                                        onChange={e => setEditSubtaskForm({...editSubtaskForm, date: e.target.value})}
                                                        className="h-10 bg-slate-50 border-slate-200 rounded-xl px-4 text-[13px] font-medium"
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between gap-6">
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Start</span>
                                                            <input 
                                                                type="time" 
                                                                value={editSubtaskForm.startTime}
                                                                onChange={e => {
                                                                    const hours = calculateHours(e.target.value, editSubtaskForm.endTime);
                                                                    setEditSubtaskForm({...editSubtaskForm, startTime: e.target.value, hours});
                                                                }}
                                                                className="text-sm font-bold bg-transparent outline-none tabular-nums"
                                                            />
                                                        </div>
                                                        <ChevronRight size={12} className="text-slate-200" />
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">End</span>
                                                            <input 
                                                                type="time" 
                                                                value={editSubtaskForm.endTime}
                                                                onChange={e => {
                                                                    const hours = calculateHours(editSubtaskForm.startTime, e.target.value);
                                                                    setEditSubtaskForm({...editSubtaskForm, endTime: e.target.value, hours});
                                                                }}
                                                                className="text-sm font-bold bg-transparent outline-none tabular-nums"
                                                            />
                                                        </div>
                                                        <div className="h-6 w-[1px] bg-slate-100 mx-2" />
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total</span>
                                                            <span className="text-sm font-black text-[#0c64ef] tabular-nums">{editSubtaskForm.hours}h</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => setEditingSubtaskId(null)} className="h-10 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all">Cancel</button>
                                                        <Button onClick={() => handleUpdateSubtask(sub.id)} disabled={isUpdatingSubtask} className="h-10 px-6 rounded-xl bg-[#0c64ef] text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-100">
                                                            {isUpdatingSubtask ? '...' : 'Save'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center justify-between hover:border-[#0c64ef] transition-all duration-300">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-800 font-bold text-[11px]">
                                                        {sub.hours_spent}h
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-[13px] text-slate-800 leading-tight">{sub.name}</h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{employees.find(e => e.id === sub.employee_id)?.name}</span>
                                                            <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                                                            <span className="text-[9px] font-medium text-slate-400">{sub.date_logged}</span>
                                                            {sub.start_time && (
                                                                <>
                                                                    <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                                                                    <span className="text-[9px] font-medium text-slate-400">{sub.start_time}-{sub.end_time}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {(isManager || sub.employee_id === currentUserId) && (
                                                        <>
                                                            <button 
                                                                onClick={() => startEditingSubtask(sub)}
                                                                className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-[#0c64ef] transition-all rounded-lg"
                                                            >
                                                                <PencilIcon size={14} />
                                                            </button>
                                                            <button 
                                                                onClick={() => setSubtaskToDelete({id: sub.id, name: sub.name})}
                                                                className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all rounded-lg"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-10 bg-slate-50/50 rounded-[24px] border border-dashed border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">No logs yet</p>
                                </div>
                            )}
                        </div>
                    </section>
 
                    {/* Attachments grid */}
                    <section>
                        <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest mb-8 flex items-center gap-3">
                            <Paperclip size={14} className="text-[#0c64ef]" strokeWidth={2.5} />
                            <span>Resources</span>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 rounded-lg">{attachments.length}</Badge>
                        </h3>
 
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`mb-8 p-10 rounded-[24px] border-2 border-dashed cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3 ${
                                isDragging
                                    ? 'border-[#0c64ef] bg-[#0c64ef]/5 shadow-inner'
                                    : isUploading
                                    ? 'border-slate-200 bg-slate-50'
                                    : 'border-slate-200 bg-slate-50/30 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={(e) => handleFileUpload(e.target.files)}
                            />
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-slate-400">
                                {isUploading ? <div className="w-5 h-5 border-2 border-[#0c64ef] border-t-transparent rounded-full animate-spin"></div> : <Upload size={20} />}
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">{isUploading ? 'Uploading...' : 'Drop files here'}</p>
                                <p className="text-[9px] font-medium text-slate-400 mt-1 uppercase tracking-widest opacity-60">or click to browse</p>
                            </div>
                        </div>
 
                        {attachments.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {attachments.map((file) => (
                                    <div key={file.id} className="p-4 bg-white rounded-2xl border border-slate-100 flex items-center justify-between group/file hover:border-[#0c64ef] transition-all duration-300">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                                                <Paperclip size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[12px] font-bold text-slate-800 truncate leading-tight">{file.file_name}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                    {formatFileSize(file.file_size)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 ml-auto">
                                            <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-[#0c64ef] transition-colors rounded-lg">
                                                <ExternalLink size={14} />
                                            </a>
                                            {(isManager || file.uploader_id === currentUserId) && (
                                                <button
                                                    onClick={() => handleDeleteAttachment(file.id)}
                                                    className="p-2 text-slate-400 hover:text-red-500 opacity-0 group-hover/file:opacity-100 transition-all rounded-lg"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Discussion Section */}
                    <section className="pt-8 border-t border-[#f0f0f2]">
                        <h3 className="text-[11px] font-black text-[#1d1d1f] uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
                            <MessageSquare size={14} className="text-[#ff9500]" />
                            <span>Internal Discussion</span>
                            <div className="flex-1 h-[1px] bg-[#f0f0f2]"></div>
                            <Badge variant="secondary" className="bg-[#ff9500]/10 text-[#ff9500] text-[10px] font-black px-2 h-6 flex items-center justify-center tabular-nums">{comments.length}</Badge>
                        </h3>
                        
                        <div className="space-y-8 mb-8">
                            {comments.map((comment) => (
                                <div key={comment.id} className="flex gap-4 group">
                                    <UserAvatar
                                        name={comment.author_name || '?'}
                                        avatarUrl={comment.author_avatar_url}
                                        className="w-10 h-10 rounded-xl bg-[#1d1d1f] flex-shrink-0 shadow-lg shadow-black/10"
                                        textClassName="text-white font-black text-[12px]"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-2 px-1">
                                            <div className="flex items-center gap-3">
                                                <span className="font-black text-[13px] text-[#1d1d1f] tracking-tight">{comment.author_name}</span>
                                                <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {new Date(comment.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            {(isManager || comment.author_id === currentUserId) && (
                                                <button 
                                                    onClick={() => setCommentToDelete(comment.id)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
                                                >
                                                    <Trash2 size={13} strokeWidth={2.5} />
                                                </button>
                                            )}
                                        </div>
                                        <div className="bg-slate-50/50 px-5 py-4 rounded-[20px] border border-slate-100 group-hover:border-[#0c64ef]/30 transition-all">
                                            <p className="text-sm text-slate-700 font-medium leading-relaxed">{comment.content}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
 
                        <div className="relative group">
                            <textarea 
                                value={newComment}
                                onChange={e => setNewComment(e.target.value)}
                                placeholder="Write a comment..."
                                className="w-full bg-slate-50 border border-slate-100 focus:bg-white focus:border-[#0c64ef]/30 text-slate-800 rounded-[20px] px-5 py-4 text-sm font-medium min-h-[100px] outline-none transition-all placeholder-slate-400 resize-none shadow-inner"
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleAddComment();
                                    }
                                }}
                            />
                            <div className="absolute bottom-4 right-4 flex items-center gap-2 opacity-50 group-focus-within:opacity-100 transition-opacity">
                                <button 
                                    onClick={handleAddComment}
                                    disabled={isCommenting || !newComment.trim()}
                                    className="px-4 h-9 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-[#0c64ef] transition-all disabled:opacity-30 font-bold text-[9px] uppercase tracking-widest"
                                >
                                    {isCommenting ? '...' : 'Send'}
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
 
                {/* --- SIDEBAR (RIGHT) --- */}
                <div className="lg:col-span-4 bg-slate-50/30 border-l border-slate-100 p-8 space-y-6 flex flex-col min-h-full">
                    <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm space-y-8">
                        {/* Status & Priority Controls */}
                        <div className="space-y-6">
                            <div className="space-y-3">
                                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <CheckCircle2 size={12} className="text-[#34c759]" />
                                    <span>Status</span>
                                </h4>
                                <Select 
                                    value={(task.deadline && new Date(task.deadline).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && task.status !== 'Completed') ? 'Overdue' : task.status}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdateStatus(task.id, e.target.value as Status)}
                                    className="w-full h-10 text-[10px] font-bold uppercase tracking-widest bg-slate-50 border-slate-100 rounded-xl focus:bg-white transition-all px-4 cursor-pointer"
                                    disabled={!isManager && !isEditable}
                                >
                                    <option>To Do</option>
                                    <option>In Progress</option>
                                    <option>In Review</option>
                                    <option>Blocked</option>
                                    <option>Overdue</option>
                                    <option>Completed</option>
                                </Select>
                            </div>
 
                            <div className="space-y-3">
                                <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Zap size={12} className="text-orange-400" />
                                    <span>Priority</span>
                                </h4>
                                <Select 
                                    value={task.priority}
                                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdatePriority(task.id, e.target.value as Priority)}
                                    className="w-full h-10 text-[10px] font-bold uppercase tracking-widest bg-slate-50 border-slate-100 rounded-xl focus:bg-white transition-all px-4 cursor-pointer"
                                    disabled={!isManager && !isEditable}
                                >
                                    <option>Low</option>
                                    <option>Medium</option>
                                    <option>High</option>
                                    <option>Urgent</option>
                                </Select>
                            </div>
                        </div>
 
                        {/* Assignees */}
                        <div className="space-y-4">
                            <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Users size={12} className="text-[#0c64ef]" />
                                <span>Collaborators</span>
                            </h4>
                            <div className="space-y-2.5">
                                {[task.employee_id, ...(task.assignee_ids || [])].map((id) => {
                                    const emp = employees.find(e => e.id === id);
                                    if (!emp) return null;
                                    return (
                                        <div key={`view-assignee-${id}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 group">
                                            <UserAvatar
                                                name={emp.name || '?'}
                                                avatarUrl={emp.avatar_url}
                                                className="w-8 h-8 rounded-lg bg-slate-100"
                                                textClassName="text-[11px] font-bold text-slate-600"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[12px] font-bold text-slate-800 leading-tight truncate">{emp.name}</p>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{id === task.employee_id ? 'Author' : 'Member'}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                                {isEditing && (
                                    <div className="pt-4 border-t border-slate-50 mt-4">
                                        <div className="flex flex-wrap gap-1.5">
                                            {employees.filter(e => e.id !== task.employee_id).map(emp => {
                                                const isSelected = editData.assignee_ids?.includes(emp.id);
                                                return (
                                                    <button
                                                        key={`edit-collab-${emp.id}`}
                                                        onClick={() => {
                                                            const current = editData.assignee_ids || [];
                                                            const next = isSelected 
                                                                ? current.filter(id => id !== emp.id)
                                                                : [...current, emp.id];
                                                            setEditData({ ...editData, assignee_ids: next });
                                                        }}
                                                        className={`px-2 py-1.5 rounded-lg text-[8px] font-bold transition-all border uppercase tracking-widest ${isSelected ? 'bg-[#0c64ef] text-white border-transparent' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'}`}
                                                    >
                                                        {emp.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
 
                    {/* Meta Stats */}
                    <div className="bg-slate-900 p-6 rounded-[24px] shadow-sm space-y-6 text-white">
                        <div>
                            <h4 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-4">Engagement</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/10 p-4 rounded-xl border border-white/5">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Activity</p>
                                    <p className="text-xl font-bold">{activityLogs.length}</p>
                                </div>
                                <div className="bg-white/10 p-4 rounded-xl border border-white/5">
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">Messages</p>
                                    <p className="text-xl font-bold">{comments.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Confirmation Modals */}
            <ConfirmationModal
                isOpen={!!commentToDelete}
                onClose={() => setCommentToDelete(null)}
                onConfirm={handleDeleteComment}
                title="Remove Comment"
                description="This action cannot be undone."
                confirmText="Delete"
                isLoading={isDeleting}
            />
            <ConfirmationModal
                isOpen={!!subtaskToDelete}
                onClose={() => setSubtaskToDelete(null)}
                onConfirm={confirmDeleteSubtask}
                title="Remove Work Log"
                description={`Delete activity: ${subtaskToDelete?.name}?`}
                confirmText="Delete"
                isLoading={isAddingSubtask}
            />
        </div>
    );
}
 
function ConfirmationModal({ isOpen, onClose, onConfirm, title, description, confirmText, isLoading }: { isOpen: boolean, onClose: () => void, onConfirm: () => Promise<void> | void, title: string, description: string | React.ReactNode, confirmText: string, isLoading: boolean }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
            <div className="w-full max-w-sm relative z-10 p-8 rounded-[24px] bg-white border-none shadow-2xl animate-in zoom-in-95 duration-200">
                <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest mb-4">{title}</h3>
                <div className="text-[13px] text-slate-500 font-medium mb-8 leading-relaxed">{description}</div>
                <div className="flex gap-3">
                    <Button onClick={onClose} variant="ghost" className="flex-1 h-11 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-800">Cancel</Button>
                    <Button onClick={onConfirm} disabled={isLoading} className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-red-100">
                        {isLoading ? '...' : confirmText}
                    </Button>
                </div>
            </div>
        </div>
    );
}
