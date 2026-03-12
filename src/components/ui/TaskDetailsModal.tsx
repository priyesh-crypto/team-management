import React from 'react';
import { Card, Button, Badge, Select } from './components';
import { Task, Subtask, Priority, Status, Comment, getComments, saveComment, deleteComment, updateTask, deleteTask, Profile } from '@/app/actions/actions';

interface TaskDetailsModalProps {
    task: Task;
    subtasks: Subtask[];
    employees: Profile[];
    onClose: () => void;
    onUpdateStatus: (taskId: string, status: Status) => Promise<void>;
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
        deadline: task.deadline
    });
    const [comments, setComments] = React.useState<Comment[]>([]);
    const [newComment, setNewComment] = React.useState('');
    const [isSaving, setIsSaving] = React.useState(false);
    const [isCommenting, setIsCommenting] = React.useState(false);

    React.useEffect(() => {
        loadComments();
        // Sync edit state when task updates from parent
        setEditData({
            name: task.name,
            notes: task.notes,
            priority: task.priority,
            start_date: task.start_date,
            deadline: task.deadline
        });
    }, [task.id, task.name, task.notes, task.priority, task.start_date, task.deadline]);

    const loadComments = async () => {
        const data = await getComments(task.id);
        setComments(data);
    };

    const handleSaveEdit = async () => {
        setIsSaving(true);
        try {
            await updateTask(task.id, editData);
            setIsEditing(false);
            refreshData();
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
        } catch (err) {
            alert("Failed to add comment.");
        } finally {
            setIsCommenting(false);
        }
    };

    const handleDeleteTask = async () => {
        if (confirm("Are you sure you want to delete this task? This action cannot be undone.")) {
            try {
                await deleteTask(task.id);
                onClose();
                refreshData();
            } catch (err) {
                alert("Failed to delete task.");
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 lg:p-8 bg-[#1d1d1f]/30 backdrop-blur-md animate-in fade-in duration-300">
            <Card className="w-full h-full sm:h-auto sm:max-w-5xl sm:max-h-[90vh] overflow-hidden flex flex-col p-0 shadow-[0_32px_64px_rgba(0,0,0,0.15)] animate-in zoom-in-95 duration-300 border-none bg-white sm:rounded-[2.5rem]">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-[#e5e5ea] bg-[#f5f5f7]/50">
                    <div className="flex items-center gap-3">
                        <Badge variant={task.priority}>{task.priority}</Badge>
                        <div className="w-[1px] h-4 bg-[#d2d2d7]"></div>
                        <span className="text-[10px] font-black text-[#86868b] uppercase tracking-widest">TASK ID: {task.id.slice(0, 8)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {(isManager || isEditable) && (
                            <button 
                                onClick={() => setIsEditing(!isEditing)}
                                className={`p-2 rounded-xl transition-all ${isEditing ? 'bg-[#ff3b30] text-white' : 'hover:bg-[#f5f5f7] text-[#0071e3]'}`}
                                title={isEditing ? "Cancel Editing" : "Edit Task"}
                            >
                                {isEditing ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                )}
                            </button>
                        )}
                        {isManager && (
                            <button 
                                onClick={handleDeleteTask}
                                className="p-2 hover:bg-[#ff3b30]/10 text-[#ff3b30] rounded-xl transition-all"
                                title="Delete Task"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                            </button>
                        )}
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-[#f5f5f7] rounded-xl transition-colors text-[#86868b] hover:text-[#1d1d1f]"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                        {/* Left Column: Details & Comments */}
                        <div className="lg:col-span-2 space-y-10">
                            <section>
                                {isEditing ? (
                                    <div className="space-y-4">
                                        <input 
                                            value={editData.name}
                                            onChange={e => setEditData({...editData, name: e.target.value})}
                                            className="text-2xl sm:text-4xl font-black text-[#1d1d1f] tracking-tight leading-tight w-full bg-[#f5f5f7] p-2 rounded-xl outline-none ring-2 ring-[#0071e3]/20"
                                        />
                                        <textarea 
                                            value={editData.notes}
                                            onChange={e => setEditData({...editData, notes: e.target.value})}
                                            className="text-[#1d1d1f] text-base leading-relaxed bg-[#f5f5f7] p-6 rounded-3xl border border-[#e5e5ea] w-full min-h-[150px] outline-none ring-2 ring-[#0071e3]/20"
                                        />
                                        <Button onClick={handleSaveEdit} disabled={isSaving} className="w-full">
                                            {isSaving ? 'Saving Changes...' : 'Save Updates'}
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="text-2xl sm:text-4xl font-black text-[#1d1d1f] tracking-tight leading-tight mb-4 sm:mb-6">{task.name}</h2>
                                        <div className="text-[#1d1d1f] text-sm sm:text-base leading-relaxed bg-[#f5f5f7] p-4 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-[#e5e5ea] shadow-sm">
                                            {task.notes || <span className="text-[#86868b] italic text-sm">No detailed notes provided.</span>}
                                        </div>
                                    </>
                                )}
                            </section>

                            {/* Subtasks Section */}
                            <section>
                                <h3 className="text-[12px] font-black text-[#1d1d1f] uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                    <span className="w-2 h-2 bg-[#0071e3] rounded-full"></span>
                                    <span>Work Logs</span>
                                    <div className="flex-1 h-[1px] bg-[#e5e5ea]"></div>
                                    <span className="text-[#0071e3] bg-[#0071e3]/10 px-3 py-1 rounded-full text-[10px] tabular-nums">{subtasks.length}</span>
                                </h3>
                                <div className="space-y-4">
                                    {subtasks.length > 0 ? (
                                        subtasks.sort((a,b) => new Date(b.date_logged || '').getTime() - new Date(a.date_logged || '').getTime()).map((sub, idx) => (
                                            <div key={sub.id} className="relative pl-10 group">
                                                <div className="absolute left-[11px] top-4 bottom-0 w-[2px] bg-[#f5f5f7] group-last:hidden"></div>
                                                <div className="absolute left-0 top-2 w-6 h-6 bg-white border-2 border-[#0071e3] rounded-full flex items-center justify-center z-10 shadow-sm transition-transform group-hover:scale-110">
                                                    <div className="w-2 h-2 bg-[#0071e3] rounded-full"></div>
                                                </div>
                                                
                                                <div className="bg-white p-5 rounded-2xl border border-[#e5e5ea] hover:shadow-lg transition-all cursor-default">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <h4 className="font-bold text-sm text-[#1d1d1f]">{sub.name}</h4>
                                                        <Badge variant="Low" className="tabular-nums">{sub.hours_spent}h</Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-[10px] text-[#86868b] font-bold uppercase tracking-widest flex-wrap">
                                                        <div className="flex items-center gap-1.5 bg-[#f5f5f7] px-2 py-0.5 rounded-lg border border-[#e5e5ea] text-[#1d1d1f] scale-95 origin-left">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-[#0071e3]"></div>
                                                            <span>{employees.find(e => e.id === sub.employee_id)?.name || 'Unknown'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                                            <span>{sub.date_logged}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                                            <span>{sub.start_time} - {sub.end_time}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12 bg-[#f5f5f7] rounded-[2rem] border border-dashed border-[#d2d2d7]">
                                            <div className="text-3xl mb-2">✍️</div>
                                            <p className="text-[#86868b] text-sm font-bold uppercase tracking-widest">No activity logged</p>
                                        </div>
                                    )}
                                </div>
                            </section>

                            {/* Comments Section */}
                            <section className="pt-6 border-t border-[#e5e5ea]">
                                <h3 className="text-[12px] font-black text-[#1d1d1f] uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                                    <span className="w-2 h-2 bg-[#ff9500] rounded-full"></span>
                                    <span>Discussion</span>
                                    <div className="flex-1 h-[1px] bg-[#e5e5ea]"></div>
                                    <span className="text-[#ff9500] bg-[#ff9500]/10 px-3 py-1 rounded-full text-[10px] tabular-nums">{comments.length}</span>
                                </h3>
                                
                                <div className="space-y-6 mb-8">
                                    {comments.map((comment) => (
                                        <div key={comment.id} className="flex gap-4 group">
                                            <div className="w-10 h-10 bg-gradient-to-br from-[#f5f5f7] to-[#d2d2d7] rounded-2xl flex items-center justify-center text-[#1d1d1f] font-black text-sm border border-[#e5e5ea] shadow-sm flex-shrink-0">
                                                {comment.author_name?.charAt(0)}
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-xs text-[#1d1d1f]">{comment.author_name}</span>
                                                    <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-tighter">
                                                        {new Date(comment.created_at).toLocaleDateString()} at {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {comment.author_id === currentUserId && (
                                                        <button 
                                                            onClick={async () => {
                                                                if (confirm("Delete this comment?")) {
                                                                    await deleteComment(comment.id);
                                                                    loadComments();
                                                                }
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 p-1 text-[#ff3b30] hover:bg-[#ff3b30]/10 rounded-lg transition-all"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /></svg>
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-sm text-[#1d1d1f] font-medium leading-relaxed bg-[#f5f5f7] p-4 rounded-2xl border border-transparent hover:border-[#e5e5ea] transition-all">
                                                    {comment.content}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    {comments.length === 0 && (
                                        <div className="text-center py-8 text-[#86868b] text-sm font-medium italic">
                                            No comments yet. Start the conversation!
                                        </div>
                                    )}
                                </div>

                                <div className="relative group">
                                    <textarea 
                                        value={newComment}
                                        onChange={e => setNewComment(e.target.value)}
                                        placeholder="Add a comment or feedback..."
                                        className="w-full bg-[#f5f5f7] border-2 border-transparent focus:border-[#0071e3]/30 focus:bg-white text-[#1d1d1f] rounded-3xl px-6 py-4 outline-none transition-all duration-300 min-h-[100px] text-sm font-medium placeholder-[#86868b] shadow-inner"
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
                                        className="absolute bottom-4 right-4 p-3 bg-[#0071e3] text-white rounded-2xl hover:bg-[#0077ed] transition-all disabled:opacity-50 disabled:grayscale shadow-lg shadow-[#0071e3]/20 active:scale-95"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                                    </button>
                                </div>
                            </section>
                        </div>

                        {/* Right Column: Meta & Controls */}
                        <div className="space-y-8">
                            <div className="bg-[#f5f5f7] p-8 rounded-[2.5rem] border border-[#e5e5ea] shadow-sm">
                                <h4 className="text-[11px] font-black text-[#86868b] uppercase tracking-[0.2em] mb-6 flex items-center justify-between">
                                    <span>Task Status</span>
                                    <div className="w-1.5 h-1.5 bg-[#0071e3] rounded-full animate-pulse"></div>
                                </h4>
                                {isEditable || isManager ? (
                                    <Select 
                                        value={task.status}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdateStatus(task.id, e.target.value as Status)}
                                        className="w-full h-14 text-base font-black bg-white border-2 border-[#d2d2d7] rounded-2xl shadow-sm focus:border-[#0071e3] transition-all"
                                    >
                                        <option>To Do</option>
                                        <option>In Progress</option>
                                        <option>Blocked</option>
                                        <option>Completed</option>
                                    </Select>
                                ) : (
                                    <Badge variant={task.status === 'Completed' ? 'Low' : task.status === 'Blocked' ? 'Urgent' : 'default'} className="w-full justify-center py-4 text-sm font-black tracking-widest uppercase rounded-2xl">
                                        {task.status}
                                    </Badge>
                                )}
                            </div>

                            <div className="bg-white p-8 rounded-[2.5rem] border border-[#e5e5ea] shadow-sm">
                                <h4 className="text-[11px] font-black text-[#86868b] uppercase tracking-[0.2em] mb-4">Assignees</h4>
                                <div className="space-y-3">
                                    {[task.employee_id, ...(task.assignee_ids || [])].map((id, index) => {
                                        const emp = employees.find(e => e.id === id);
                                        if (!emp) return null;
                                        return (
                                            <div key={`modal-assignee-${id}`} className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1d1d1f] to-[#434343] flex items-center justify-center text-[10px] font-black text-white shadow-sm ring-1 ring-black/5">
                                                    {emp.name?.charAt(0) || '?'}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-[#1d1d1f]">{emp.name}</span>
                                                    <span className="text-[9px] font-bold text-[#86868b] uppercase tracking-widest">{id === task.employee_id ? 'Primary Owner' : 'Collaborator'}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-white p-8 rounded-[2.5rem] border border-[#e5e5ea] shadow-sm hover:shadow-md transition-shadow">
                                    <h4 className="text-[11px] font-black text-[#86868b] uppercase tracking-[0.2em] mb-3">Priority Level</h4>
                                    {isEditing ? (
                                        <Select 
                                            value={editData.priority}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditData({...editData, priority: e.target.value as Priority})}
                                            className="w-full h-10 text-xs font-bold rounded-xl"
                                        >
                                            <option>Low</option>
                                            <option>Medium</option>
                                            <option>High</option>
                                            <option>Urgent</option>
                                        </Select>
                                    ) : (
                                        <Badge variant={task.priority} className="text-xs font-black uppercase tracking-widest px-4 py-1.5">{task.priority}</Badge>
                                    )}
                                </div>

                                <div className="bg-white p-8 rounded-[2.5rem] border border-[#e5e5ea] shadow-sm hover:shadow-md transition-shadow">
                                    <h4 className="text-[11px] font-black text-[#86868b] uppercase tracking-[0.2em] mb-3">Time Tracking</h4>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-5xl font-black text-[#1d1d1f] tracking-tighter tabular-nums">{task.hours_spent}</span>
                                        <span className="text-sm font-black text-[#86868b] uppercase tracking-widest">Hrs</span>
                                    </div>
                                    <div className="mt-4 h-2 w-full bg-[#f5f5f7] rounded-full overflow-hidden">
                                        <div className="h-full bg-[#0071e3] rounded-full" style={{ width: `${Math.min((task.hours_spent / 40) * 100, 100)}%` }}></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-[#86868b] mt-2 uppercase">of weekly capacity (40h)</p>
                                </div>
                                
                                <div className="bg-white p-8 rounded-[2.5rem] border border-[#e5e5ea] shadow-sm hover:shadow-md transition-shadow">
                                    <h4 className="text-[11px] font-black text-[#86868b] uppercase tracking-[0.2em] mb-5">Timeline</h4>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center group/item">
                                            <span className="text-[10px] font-black text-[#86868b] uppercase tracking-widest group-hover/item:text-[#1d1d1f] transition-colors">Start</span>
                                            {isEditing ? (
                                                <input type="date" value={editData.start_date} onChange={e => setEditData({...editData, start_date: e.target.value})} className="text-xs font-bold outline-none bg-[#f5f5f7] px-2 py-1 rounded-lg" />
                                            ) : (
                                                <span className="text-sm font-black text-[#1d1d1f] tracking-tight">{task.start_date}</span>
                                            )}
                                        </div>
                                        <div className="h-[1px] bg-[#f5f5f7]"></div>
                                        <div className="flex justify-between items-center group/item">
                                            <span className="text-[10px] font-black text-[#86868b] uppercase tracking-widest group-hover/item:text-[#1d1d1f] transition-colors">Deadline</span>
                                            {isEditing ? (
                                                <input type="date" value={editData.deadline} onChange={e => setEditData({...editData, deadline: e.target.value})} className="text-xs font-bold outline-none bg-[#f5f5f7] px-2 py-1 rounded-lg" />
                                            ) : (
                                                <span className="text-sm font-black text-[#ff3b30] tracking-tight">{task.deadline}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6">
                                <Button 
                                    onClick={onClose}
                                    variant="secondary"
                                    className="w-full h-16 text-[12px] font-black uppercase tracking-[0.2em] rounded-3xl border-2 border-[#d2d2d7] hover:bg-[#1d1d1f] hover:text-white hover:border-[#1d1d1f] transition-all transform active:scale-[0.98]"
                                >
                                    Close Details
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
