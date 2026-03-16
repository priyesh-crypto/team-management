import React from 'react';
import { Card, Button, Badge, Select, Input } from './components';
import { Task, Subtask, Priority, Status, Comment, getComments, saveComment, deleteComment, updateTask, Profile, ActivityLog, getActivityLogs, Attachment, getAttachments } from '@/app/actions/actions';
import { Trash2, MessageSquare, Clock, Users, Calendar, X, ExternalLink, Pencil as PencilIcon, Save, History, CheckCircle2, PlusCircle, AlertCircle, Paperclip } from 'lucide-react';

interface TaskDetailsModalProps {
    task: Task;
    subtasks: Subtask[];
    employees: Profile[];
    onClose: () => void;
    onUpdateStatus: (taskId: string, status: Status) => Promise<void>;
    onDeleteTask: (taskId: string, taskName: string) => void;
    isEditable?: boolean;
    currentUserId: string;
    isManager?: boolean;
    refreshData: () => void;
}

export function TaskDetailsModal({ 
    task, 
    subtasks, 
    employees, 
    onClose, 
    onUpdateStatus, 
    onDeleteTask,
    isEditable = true,
    currentUserId,
    isManager = false,
    refreshData
}: TaskDetailsModalProps) {
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

    React.useEffect(() => {
        loadComments();
        loadAttachments();
        loadActivity();
        setEditData({
            name: task.name,
            notes: task.notes,
            priority: task.priority,
            start_date: task.start_date,
            deadline: task.deadline,
            assignee_ids: task.assignee_ids || []
        });
    }, [task.id, task.name, task.notes, task.priority, task.start_date, task.deadline, task.assignee_ids]);

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

    const handleSaveEdit = async () => {
        setIsSaving(true);
        try {
            await updateTask(task.id, editData);
            setIsEditing(false);
            refreshData();
            loadActivity();
        } catch (err) {
            alert("Failed to update task.");
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
            alert("Failed to add comment.");
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
            alert("Failed to delete comment.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#1d1d1f]/40 backdrop-blur-md animate-in fade-in duration-200">
            <Card className="w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col p-0 shadow-[0_32px_64px_rgba(0,0,0,0.2)] animate-in zoom-in-95 duration-200 border-none bg-white rounded-3xl">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5e5ea] bg-[#f5f5f7]/30">
                    <div className="flex items-center gap-3">
                        <Badge variant={task.priority} className="text-[10px] px-2 py-0.5 font-black uppercase tracking-widest">{task.priority}</Badge>
                        <div className="w-[1px] h-3 bg-[#d2d2d7]"></div>
                        <span className="text-[9px] font-black text-[#86868b] uppercase tracking-[0.15em] tabular-nums">ID: {task.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {(isManager || isEditable) && (
                            <button 
                                onClick={() => setIsEditing(!isEditing)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isEditing ? 'bg-[#ff3b30] text-white' : 'hover:bg-[#f5f5f7] text-[#1d1d1f]'}`}
                                title={isEditing ? "Cancel" : "Edit"}
                            >
                                {isEditing ? <X size={16} strokeWidth={2.5} /> : <PencilIcon size={16} strokeWidth={2.5} />}
                            </button>
                        )}
                        {isManager && (
                            <button 
                                onClick={() => onDeleteTask(task.id, task.name)}
                                className="w-8 h-8 rounded-lg hover:bg-[#ff3b30]/10 text-[#ff3b30] flex items-center justify-center transition-all"
                                title="Delete Task"
                            >
                                <Trash2 size={16} strokeWidth={2.5} />
                            </button>
                        )}
                        <div className="w-[1px] h-3 bg-[#d2d2d7] mx-1"></div>
                        <button 
                            onClick={onClose}
                            className="w-8 h-8 rounded-lg hover:bg-[#f5f5f7] flex items-center justify-center transition-colors text-[#86868b] hover:text-[#1d1d1f]"
                        >
                            <X size={18} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        {/* Left Column: Details & Comments */}
                        <div className="lg:col-span-2 space-y-8">
                            <section>
                                {isEditing ? (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Task Name</label>
                                            <Input 
                                                value={editData.name}
                                                onChange={e => setEditData({...editData, name: e.target.value})}
                                                className="h-11 rounded-xl bg-[#f5f5f7] border-none px-5 text-lg font-black tracking-tight"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Detailed Notes</label>
                                            <textarea 
                                                value={editData.notes}
                                                onChange={e => setEditData({...editData, notes: e.target.value})}
                                                className="w-full min-h-[120px] rounded-2xl bg-[#f5f5f7] border-none p-5 text-sm font-medium resize-none focus:ring-1 ring-[#0071e3]"
                                            />
                                        </div>

                                        {/* Contributor Selection */}
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Add Contributors</label>
                                            <div className="flex flex-wrap gap-2 p-4 bg-[#f5f5f7] rounded-2xl border border-[#e5e5ea]">
                                                {employees.filter(e => e.id !== task.employee_id).map(emp => {
                                                    const isSelected = editData.assignee_ids?.includes(emp.id);
                                                    return (
                                                        <button
                                                            key={emp.id}
                                                            type="button"
                                                            onClick={() => {
                                                                const current = editData.assignee_ids || [];
                                                                const next = isSelected 
                                                                    ? current.filter(id => id !== emp.id)
                                                                    : [...current, emp.id];
                                                                setEditData({ ...editData, assignee_ids: next });
                                                            }}
                                                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${isSelected ? 'bg-[#0071e3] text-white shadow-md' : 'bg-white text-[#86868b] hover:bg-[#e5e5ea] border border-[#e5e5ea]'}`}
                                                        >
                                                            {emp.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <Button onClick={handleSaveEdit} disabled={isSaving} className="w-full h-11 rounded-xl bg-[#1d1d1f] hover:bg-black font-black tracking-widest text-[10px]">
                                            <Save size={14} className="mr-2" /> {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <h2 className="text-3xl font-black text-[#1d1d1f] tracking-tighter leading-none">{task.name}</h2>
                                        <div className="bg-[#f5f5f7] p-6 rounded-2xl border border-[#e5e5ea] shadow-sm">
                                            <p className="text-[#1d1d1f] text-sm leading-relaxed font-medium">
                                                {task.notes || <span className="text-[#86868b] italic">No description provided.</span>}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </section>

                            {/* Activity Timeline Section */}
                            <section>
                                <h3 className="text-[10px] font-black text-[#1d1d1f] uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                                    <History size={12} className="text-[#0071e3]" />
                                    <span>Activity History</span>
                                    <div className="flex-1 h-[1px] bg-[#f0f0f2]"></div>
                                </h3>
                                <div className="space-y-6 ml-2 border-l-2 border-[#f0f0f2] pl-6 py-2">
                                    {activityLogs.length > 0 ? (
                                        activityLogs.map((log) => {
                                            let Icon = History;
                                            let iconBg = 'bg-[#f5f5f7]';
                                            let iconColor = 'text-[#86868b]';

                                            if (log.type === 'task_created') {
                                                Icon = PlusCircle;
                                                iconBg = 'bg-[#34c759]/10';
                                                iconColor = 'text-[#34c759]';
                                            } else if (log.type === 'task_status_changed') {
                                                Icon = CheckCircle2;
                                                iconBg = 'bg-[#0071e3]/10';
                                                iconColor = 'text-[#0071e3]';
                                            } else if (log.type === 'comment_added') {
                                                Icon = MessageSquare;
                                                iconBg = 'bg-[#ff9500]/10';
                                                iconColor = 'text-[#ff9500]';
                                            }

                                            return (
                                                <div key={log.id} className="relative">
                                                    <div className={`absolute -left-[35px] top-0 w-4 h-4 rounded-full ${iconBg} border-2 border-white flex items-center justify-center ${iconColor} shadow-sm z-10`}>
                                                        <Icon size={8} strokeWidth={3} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-bold text-[#1d1d1f] leading-snug">{log.description}</p>
                                                        <div className="flex items-center gap-1.5 mt-1">
                                                            <span className="text-[9px] font-black text-[#86868b] uppercase tracking-wider">{log.actor_name}</span>
                                                            <div className="w-0.5 h-0.5 bg-[#d2d2d7] rounded-full"></div>
                                                            <span className="text-[9px] font-medium text-[#c7c7cc] tabular-nums">
                                                                {new Date(log.created_at).toLocaleDateString()} at {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="text-center py-6">
                                            <p className="text-[9px] font-black text-[#c7c7cc] uppercase tracking-widest">Beginning of records</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Activity Timeline Section ... */}

                            {/* Attachments Section */}
                            <section>
                                <h3 className="text-[10px] font-black text-[#1d1d1f] uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                                    <Paperclip size={12} className="text-[#34c759]" />
                                    <span>Attachments</span>
                                    <div className="flex-1 h-[1px] bg-[#f0f0f2]"></div>
                                    <Badge variant="secondary" className="bg-[#34c759]/10 text-[#34c759] text-[9px] px-1.5 h-5 flex items-center justify-center tabular-nums">{attachments.length}</Badge>
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    {attachments.map((file) => (
                                        <div key={file.id} className="p-3 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] flex items-center justify-between group/file hover:border-[#34c759] transition-all">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-8 h-8 rounded-lg bg-white border border-[#e5e5ea] flex items-center justify-center text-[#34c759]">
                                                    <ExternalLink size={14} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[11px] font-bold text-[#1d1d1f] truncate">{file.file_name}</p>
                                                    <p className="text-[8px] font-medium text-[#86868b] uppercase tracking-widest">Added {new Date(file.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <a href={file.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-[#86868b] hover:text-[#0071e3] transition-colors">
                                                <ExternalLink size={14} />
                                            </a>
                                        </div>
                                    ))}
                                    {attachments.length === 0 && (
                                        <div className="col-span-2 text-center py-6 bg-[#f5f5f7]/50 rounded-2xl border border-dashed border-[#e5e5ea]">
                                            <p className="text-[9px] font-black text-[#86868b] uppercase tracking-[0.2em] opacity-40">No attachments found</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Subtasks Section */}
                            <section>
                                <h3 className="text-[10px] font-black text-[#1d1d1f] uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                                    <span className="w-1.5 h-1.5 bg-[#0071e3] rounded-full"></span>
                                    <span>Work Logs</span>
                                    <div className="flex-1 h-[1px] bg-[#f0f0f2]"></div>
                                    <Badge variant="secondary" className="bg-[#f0f0f2] text-[9px] px-1.5 h-5 flex items-center justify-center tabular-nums">{subtasks.length}</Badge>
                                </h3>
                                <div className="space-y-3">
                                    {subtasks.length > 0 ? (
                                        subtasks.sort((a,b) => new Date(b.date_logged || '').getTime() - new Date(a.date_logged || '').getTime()).map((sub) => (
                                            <div key={sub.id} className="p-3 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] flex items-center justify-between group hover:border-[#0071e3] transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-white border border-[#e2e2e7] flex items-center justify-center text-[#1d1d1f] font-black text-[10px] shadow-sm">
                                                        {sub.hours_spent}h
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-[11px] text-[#1d1d1f] leading-tight">{sub.name}</h4>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider">{employees.find(e => e.id === sub.employee_id)?.name}</span>
                                                            <div className="w-1 h-1 bg-[#d2d2d7] rounded-full"></div>
                                                            <span className="text-[9px] font-medium text-[#86868b] tabular-nums">{sub.date_logged}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-10 bg-[#f5f5f7] rounded-2xl border border-dashed border-[#d2d2d7]">
                                            <p className="text-[9px] font-black text-[#86868b] uppercase tracking-widest">No activity found</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Comments Section */}
                            <section className="pt-6 border-t border-[#f0f0f2]">
                                <h3 className="text-[10px] font-black text-[#1d1d1f] uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                                    <MessageSquare size={12} className="text-[#ff9500]" />
                                    <span>Discussion</span>
                                    <div className="flex-1 h-[1px] bg-[#f0f0f2]"></div>
                                    <Badge variant="secondary" className="bg-[#ff9500]/10 text-[#ff9500] text-[9px] px-1.5 h-5 flex items-center justify-center tabular-nums">{comments.length}</Badge>
                                </h3>
                                
                                <div className="space-y-5 mb-6">
                                    {comments.map((comment) => (
                                        <div key={comment.id} className="flex gap-4 group animate-in slide-in-from-left-2 duration-300">
                                            <div className="w-9 h-9 bg-[#1d1d1f] rounded-xl flex items-center justify-center text-white font-black text-[11px] flex-shrink-0 shadow-lg shadow-[#1d1d1f]/10">
                                                {comment.author_name?.charAt(0)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1.5 px-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-[11px] text-[#1d1d1f] tracking-tight">{comment.author_name}</span>
                                                        <span className="text-[8px] font-black text-[#86868b] uppercase tracking-widest tabular-nums opacity-60">
                                                            {new Date(comment.created_at).toLocaleDateString()}
                                                        </span>
                                                    </div>
                                                    {(isManager || comment.author_id === currentUserId) && (
                                                        <button 
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                setCommentToDelete(comment.id);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 p-1 text-[#ff3b30] hover:bg-[#ff3b30]/10 rounded-lg transition-all cursor-pointer"
                                                            title="Delete comment"
                                                        >
                                                            <Trash2 size={12} strokeWidth={2.5} />
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="bg-[#f5f5f7] px-5 py-4 rounded-2xl border border-transparent hover:border-[#e5e5ea] transition-all shadow-sm">
                                                    <p className="text-xs text-[#1d1d1f] font-medium leading-relaxed">{comment.content}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {comments.length === 0 && (
                                        <div className="text-center py-8 bg-[#f5f5f7]/50 rounded-2xl border border-dashed border-[#e5e5ea]">
                                            <p className="text-[10px] font-black text-[#86868b] uppercase tracking-[0.2em] opacity-40">No discussion yet</p>
                                        </div>
                                    )}
                                </div>

                                <div className="relative">
                                    <textarea 
                                        value={newComment}
                                        onChange={e => setNewComment(e.target.value)}
                                        placeholder="Add a comment..."
                                        className="w-full bg-[#f5f5f7] border-none focus:ring-1 ring-[#0071e3]/30 text-[#1d1d1f] rounded-xl px-5 py-3 text-xs font-medium min-h-[80px] outline-none transition-all placeholder-[#86868b]"
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleAddComment();
                                            }
                                        }}
                                    />
                                    <button 
                                        onClick={handleAddComment}
                                        disabled={isCommenting || !newComment.trim()}
                                        className="absolute bottom-3 right-3 w-8 h-8 bg-[#1d1d1f] text-white rounded-lg flex items-center justify-center hover:bg-black transition-all disabled:opacity-30 disabled:grayscale shadow-md"
                                    >
                                        <Save size={14} />
                                    </button>
                                </div>
                            </section>
                        </div>

                        {/* Right Column: Meta & Controls */}
                        <div className="space-y-6">
                            <div className="bg-[#f5f5f7] p-6 rounded-2xl border border-[#e5e5ea]">
                                <h4 className="text-[9px] font-black text-[#86868b] uppercase tracking-[0.2em] mb-4 flex items-center justify-between">
                                    <span>Status</span>
                                    <Clock size={12} className="text-[#0071e3]" />
                                </h4>
                                {isEditable || isManager ? (
                                    <Select 
                                        value={task.status}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdateStatus(task.id, e.target.value as Status)}
                                        className="w-full h-10 text-[11px] font-bold bg-white border border-[#d2d2d7] rounded-xl focus:ring-1 ring-[#0071e3] transition-all"
                                    >
                                        <option>To Do</option>
                                        <option>In Progress</option>
                                        <option>In Review</option>
                                        <option>Blocked</option>
                                        <option>Completed</option>
                                    </Select>
                                ) : (
                                    <div className="w-full h-10 bg-white rounded-xl border border-[#e5e5ea] flex items-center justify-center">
                                        <span className="text-[11px] font-black uppercase tracking-widest text-[#1d1d1f]">{task.status}</span>
                                    </div>
                                )}
                            </div>

                            <div className="bg-white p-6 rounded-2xl border border-[#e5e5ea] shadow-sm">
                                <h4 className="text-[9px] font-black text-[#86868b] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <Users size={12} />
                                    <span>Assignees</span>
                                </h4>
                                <div className="space-y-2.5">
                                    {[task.employee_id, ...(task.assignee_ids || [])].map((id) => {
                                        const emp = employees.find(e => e.id === id);
                                        if (!emp) return null;
                                        return (
                                            <div key={`modal-assignee-${id}`} className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-lg bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center text-[10px] font-black text-[#1d1d1f]">
                                                    {emp.name?.charAt(0) || '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-black text-[#1d1d1f] leading-tight truncate">{emp.name}</p>
                                                    <p className="text-[8px] font-bold text-[#86868b] uppercase tracking-widest mt-0.5">{id === task.employee_id ? 'Owner' : 'Collab'}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-[#f5f5f7] p-5 rounded-2xl border border-[#e5e5ea]">
                                    <h4 className="text-[9px] font-black text-[#86868b] uppercase tracking-[0.2em] mb-3">Priority</h4>
                                    {isEditing ? (
                                        <Select 
                                            value={editData.priority}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditData({...editData, priority: e.target.value as Priority})}
                                            className="w-full h-9 text-[10px] font-bold rounded-lg"
                                        >
                                            <option>Low</option>
                                            <option>Medium</option>
                                            <option>High</option>
                                            <option>Urgent</option>
                                        </Select>
                                    ) : (
                                        <Badge variant={task.priority} className="text-[9px] font-black px-3 py-0.5">{task.priority}</Badge>
                                    )}
                                </div>

                                <div className="bg-white p-6 rounded-2xl border border-[#e5e5ea] shadow-sm">
                                    <h4 className="text-[9px] font-black text-[#86868b] uppercase tracking-[0.2em] mb-3">Time Spent</h4>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-3xl font-black text-[#1d1d1f] tabular-nums tracking-tighter">{task.hours_spent}</span>
                                        <span className="text-[10px] font-black text-[#86868b] uppercase tracking-widest">Hrs</span>
                                    </div>
                                    <div className="mt-3 h-1.5 w-full bg-[#f5f5f7] rounded-full overflow-hidden">
                                        <div className="h-full bg-[#0071e3] rounded-full transition-all duration-500" style={{ width: `${Math.min((task.hours_spent / 40) * 100, 100)}%` }}></div>
                                    </div>
                                </div>
                                
                                <div className="bg-white p-6 rounded-2xl border border-[#e5e5ea] shadow-sm">
                                    <h4 className="text-[9px] font-black text-[#86868b] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                        <Calendar size={12} />
                                        <span>Timeline</span>
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] font-bold text-[#86868b] uppercase">Start</span>
                                            {isEditing ? (
                                                <input type="date" value={editData.start_date} onChange={e => setEditData({...editData, start_date: e.target.value})} className="text-[10px] font-bold outline-none bg-[#f5f5f7] px-2 py-1 rounded-md" />
                                            ) : (
                                                <span className="text-[10px] font-black text-[#1d1d1f]">{task.start_date}</span>
                                            )}
                                        </div>
                                        <div className="h-[1px] bg-[#f0f0f2]"></div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[9px] font-bold text-[#86868b] uppercase">Due</span>
                                            {isEditing ? (
                                                <input type="date" value={editData.deadline} onChange={e => setEditData({...editData, deadline: e.target.value})} className="text-[10px] font-bold outline-none bg-[#f5f5f7] px-2 py-1 rounded-md" />
                                            ) : (
                                                <span className="text-[10px] font-black text-[#ff3b30]">{task.deadline}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <Button 
                                onClick={onClose}
                                variant="secondary"
                                className="w-full h-11 text-[10px] font-black uppercase tracking-widest rounded-xl border border-[#d2d2d7] hover:bg-[#1d1d1f] hover:text-white transition-all transform active:scale-[0.98]"
                            >
                                CLOSE DETAILS
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
        
        {/* Delete Confirmation Popup */}
        {commentToDelete && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                <Card className="w-full max-w-sm p-8 rounded-[32px] bg-white shadow-2xl animate-in zoom-in-95 duration-200 border-none">
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 bg-[#ff3b30]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Trash2 size={32} className="text-[#ff3b30]" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-xl font-black text-[#1d1d1f] tracking-tight">Delete Comment?</h3>
                        <p className="text-xs text-[#86868b] font-medium leading-relaxed">
                            This action cannot be undone. The activity log will record who deleted this comment.
                        </p>
                        <div className="grid grid-cols-2 gap-3 pt-6">
                            <Button 
                                onClick={() => setCommentToDelete(null)}
                                variant="secondary"
                                className="h-11 text-[10px] font-black uppercase tracking-widest rounded-xl"
                                disabled={isDeleting}
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleDeleteComment}
                                variant="danger"
                                className="h-11 text-[10px] font-black uppercase tracking-widest rounded-xl bg-[#ff3b30] hover:bg-[#d73228]"
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Confirm'}
                            </Button>
                        </div>
                    </div>
                </Card>
            </div>
        )}
        </>
    );
}
