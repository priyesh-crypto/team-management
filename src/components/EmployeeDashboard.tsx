"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { TaskDetailsModal } from '@/components/ui/TaskDetailsModal';
import { Task, Subtask, Profile, Priority, Status, getTasks, getProfiles, saveTask, updateTaskStatus, deleteTask, updateTask, getSubtasks, getBulkSubtasks, saveSubtask, updateSubtaskStatus, updateSubtaskHours, deleteSubtask, updateSubtask, updateProfile, changePassword, updateOwnPassword, getNotifications, markNotificationAsRead, markAllNotificationsAsRead, clearNotifications, Notification } from '@/app/actions/actions';
import { Card, Button, Input, Select, Badge } from '@/components/ui/components';
import { Menu, X } from 'lucide-react';

// Helper component for Sidebar items
const NavItem = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${active
                ? 'bg-[#0071e3] text-white shadow-[0_4px_20px_rgba(0,113,227,0.3)]'
                : 'text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]'
            }`}
    >
        <span className={`${active ? 'text-white' : 'text-[#86868b] group-hover:text-[#1d1d1f]'}`}>
            {icon}
        </span>
        <span className="font-bold text-[11px] uppercase tracking-wider">{label}</span>
    </button>
);

// Helper for Circular Progress
const CircularProgress = ({ percentage, color = "#0071e3" }: { percentage: number, color?: string }) => {
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center">
            <svg className="w-40 h-40 transform -rotate-90">
                <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke="#e5e5ea"
                    strokeWidth="12"
                    fill="transparent"
                />
                <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    stroke={color}
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-4xl font-black text-[#1d1d1f]">{Math.round(percentage)}%</span>
                <span className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">Completed</span>
            </div>
        </div>
    );
};

export default function EmployeeDashboard({ userId, userName }: { userId: string, userName: string }) {
    const [activeTab, setActiveTab] = useState<'mine' | 'team' | 'settings'>('mine');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTask, setSelectedTask] = useState<{ task: Task, subtasks: Subtask[] } | null>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // Data
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [myTasks, setMyTasks] = useState<Task[]>([]);
    const [employees, setEmployees] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [formData, setFormData] = useState<{
        name: string,
        start_date: string,
        deadline: string,
        priority: Priority,
        hours_spent: number,
        status: Status,
        notes: string,
        start_time: string,
        end_time: string,
        assignee_ids: string[]
    }>({
        name: '',
        start_date: new Date().toISOString().split('T')[0],
        deadline: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        priority: 'Medium',
        hours_spent: 0,
        status: 'To Do',
        notes: '',
        start_time: '09:00',
        end_time: '17:00',
        assignee_ids: []
    });

    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editTaskData, setEditTaskData] = useState<Partial<Task>>({});
    const [subtasksMap, setSubtasksMap] = useState<Record<string, Subtask[]>>({});
    const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
    const [editSubtaskData, setEditSubtaskData] = useState<Partial<Subtask>>({});
    const [newSubtaskData, setNewSubtaskData] = useState<Record<string, { 
        name: string, 
        hours: number,
        start_time: string,
        end_time: string,
        date_logged: string
    }>>({});
    const [error, setError] = useState<string | null>(null);
    const [profileName, setProfileName] = useState(userName);
    const [passwords, setPasswords] = useState({ new: '', confirm: '' });
    const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        refreshData();
    }, [userId]);

    const refreshData = async () => {
        setLoading(true);
        try {
            const [tasks, profiles] = await Promise.all([getTasks(), getProfiles()]);

            setAllTasks(tasks);
            const myTasksFiltered = tasks.filter(t => t.employee_id === userId || (t.assignee_ids && t.assignee_ids.includes(userId)));
            setMyTasks(myTasksFiltered);
            setEmployees(profiles);

            // Sync selected task if it's open
            if (selectedTask) {
                const updatedTask = tasks.find(t => t.id === selectedTask.task.id);
                if (updatedTask) {
                    const subtasks = await getSubtasks(updatedTask.id);
                    setSelectedTask({ task: updatedTask, subtasks });
                }
            }

            // Fetch notifications
            const notifs = await getNotifications(userId);
            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.is_read).length);

            // Fetch subtasks for all tasks in bulk
            const taskIds = tasks.map(t => t.id);
            const allSubtasks = await getBulkSubtasks(taskIds);
            
            const newSubtasksMap: Record<string, Subtask[]> = {};
            allSubtasks.forEach(st => {
                if (!newSubtasksMap[st.task_id]) newSubtasksMap[st.task_id] = [];
                newSubtasksMap[st.task_id].push(st);
            });
            setSubtasksMap(newSubtasksMap);
        } catch (error) {
            console.error("Error refreshing employee dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleTaskClick = async (task: Task) => {
        const subtasks = await getSubtasks(task.id);
        setSelectedTask({ task, subtasks });
    };

    const handleUpdateStatusFromModal = async (taskId: string, status: Status) => {
        setIsUpdatingStatus(true);
        try {
            await updateTaskStatus(taskId, status);
            await refreshData();
            
            if (selectedTask && selectedTask.task.id === taskId) {
                const updatedTask = allTasks.find(t => t.id === taskId);
                if (updatedTask) {
                    const subtasks = await getSubtasks(taskId);
                    setSelectedTask({ task: updatedTask, subtasks: subtasks });
                }
            }
        } finally {
            setIsUpdatingStatus(false);
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);


        const { start_time, end_time, ...taskData } = formData;

        const newTaskData = {
            ...taskData,
            employee_id: userId,
            hours_spent: Number(formData.hours_spent),
            name: formData.name,
            start_date: formData.start_date,
            deadline: formData.deadline,
            priority: formData.priority as Priority,
            status: formData.status as Status,
            notes: formData.notes || ''
        };

        try {
            await saveTask(newTaskData);
            refreshData();

            // Reset form partially
            setFormData(prev => ({
                ...prev,
                name: '',
                hours_spent: 0,
                notes: '',
                assignee_ids: []
            }));
        } catch (err: any) {
            setError(err.message || 'Failed to save task.');
        }
    };

    const handleUpdateTask = async (taskId: string) => {
        try {
            // Clean the payload to ensure only relevant fields are sent
            const { id: _, created_at: __, ...sanitizedData } = editTaskData as any;
            await updateTask(taskId, sanitizedData);
            setEditingTaskId(null);
            refreshData();
        } catch (err: any) {
            alert(err.message || "Failed to update task.");
        }
    };

    const handleAddSubtask = async (taskId: string) => {
        const data = newSubtaskData[taskId];
        if (!data?.name?.trim()) return;

        try {
            await saveSubtask({ 
                task_id: taskId, 
                employee_id: userId,
                name: data.name.trim(), 
                hours_spent: Number(data.hours) || 0,
                is_completed: false,
                start_time: data.start_time,
                end_time: data.end_time,
                date_logged: data.date_logged
            });
            setNewSubtaskData(prev => ({ 
                ...prev, 
                [taskId]: { 
                    name: '', 
                    hours: 8, 
                    start_time: '09:00', 
                    end_time: '17:00', 
                    date_logged: new Date().toISOString().split('T')[0] 
                } 
            }));
            const updatedSubtasks = await getSubtasks(taskId);
            setSubtasksMap(prev => ({ ...prev, [taskId]: updatedSubtasks }));
            // Also refresh main tasks since hours_spent on task might have changed
            const updatedTasks = await getTasks();
            setAllTasks(updatedTasks);
            setMyTasks(updatedTasks.filter(t => t.employee_id === userId || (t.assignee_ids && t.assignee_ids.includes(userId))));
        } catch (err: any) {
            alert("Failed to add subtask.");
        }
    };

    const handleToggleSubtask = async (taskId: string, subtaskId: string, isCompleted: boolean) => {
        try {
            await updateSubtaskStatus(subtaskId, taskId, isCompleted);
            const updatedSubtasks = await getSubtasks(taskId);
            setSubtasksMap(prev => ({ ...prev, [taskId]: updatedSubtasks }));
        } catch (err: any) {
            alert("Failed to update status.");
        }
    };

    const handleSaveSubtaskEdit = async (taskId: string) => {
        if (!editingSubtaskId) return;
        try {
            await updateSubtask({
                ...editSubtaskData,
                id: editingSubtaskId,
                task_id: taskId
            });
            setEditingSubtaskId(null);
            setEditSubtaskData({});
            const updatedSubtasks = await getSubtasks(taskId);
            setSubtasksMap(prev => ({ ...prev, [taskId]: updatedSubtasks }));
            // Refresh main tasks to update total hours
            const tasks = await getTasks();
            setMyTasks(tasks.filter(t => t.employee_id === userId));
        } catch (err: any) {
            alert("Failed to update subtask.");
        }
    };

    const handleDeleteSubtask = async (taskId: string, subtaskId: string) => {
        if (!confirm("Delete this subtask?")) return;
        try {
            await deleteSubtask(subtaskId, taskId);
            const updatedSubtasks = await getSubtasks(taskId);
            setSubtasksMap(prev => ({ ...prev, [taskId]: updatedSubtasks }));
            // Also refresh main tasks since hours_spent on task might have changed
            const tasks = await getTasks();
            setMyTasks(tasks.filter(t => t.employee_id === userId));
        } catch (err: any) {
            alert("Failed to delete subtask.");
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!confirm("Are you sure you want to delete this task? This cannot be undone.")) return;
        try {
            await deleteTask(taskId);
            await refreshData();
        } catch (err: any) {
            alert(err.message || "Failed to delete task.");
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUpdatingProfile(true);
        setProfileMsg(null);
        try {
            await updateProfile(userId, { name: profileName });
            setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
        } catch (err: any) {
            setProfileMsg({ type: 'error', text: err.message || 'Failed to update profile.' });
        } finally {
            setIsUpdatingProfile(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            setProfileMsg({ type: 'error', text: 'Passwords do not match.' });
            return;
        }
        if (passwords.new.length < 6) {
            setProfileMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
            return;
        }
        setIsUpdatingPassword(true);
        setProfileMsg(null);
        try {
            await changePassword(passwords.new);
            setProfileMsg({ type: 'success', text: 'Password changed successfully!' });
            setPasswords({ new: '', confirm: '' });
        } catch (err: any) {
            setProfileMsg({ type: 'error', text: err.message || 'Failed to change password.' });
        } finally {
            setIsUpdatingPassword(false);
        }
    };

    const handleMarkAsRead = async (notification: any) => {
        if (!notification.is_read) {
            await markNotificationAsRead(notification.id);
            const updated = notifications.map(n => n.id === notification.id ? { ...n, is_read: true } : n);
            setNotifications(updated);
            setUnreadCount(updated.filter(n => !n.is_read).length);
        }

        if (notification.task_id) {
            const task = allTasks.find(t => t.id === notification.task_id);
            if (task) {
                handleTaskClick(task);
                setShowNotifications(false);
            }
        }
    };

    const getEmployeeName = (id: string) => {
        return employees.find(e => e.id === id)?.name || 'Unknown';
    };

    // Shared Task Card Renderer
    const renderTaskList = (tasksList: Task[], showAssignee = false) => {
        if (loading) {
            return <div className="text-center py-10 font-semibold text-[#86868b] animate-pulse">Loading data...</div>;
        }

        if (tasksList.length === 0) {
            return (
                <Card className="text-center py-16">
                    <p className="text-[#86868b] text-lg font-medium">No tasks found.</p>
                </Card>
            );
        }

        return (
            <div className="space-y-4 max-h-[500px] sm:max-h-[750px] overflow-y-auto pr-2 pb-4">
                {tasksList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(task => {
                    const isEditing = editingTaskId === task.id;
                    const subtasks = subtasksMap[task.id] || [];

                    return (
                        <div 
                            key={task.id} 
                            onClick={() => {
                                if (!isEditing) {
                                    handleTaskClick(task);
                                }
                            }}
                            className="p-5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all duration-300 cursor-pointer border border-[#e5e5ea] rounded-3xl hover:-translate-y-1 bg-white"
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex-1">
                                    {isEditing ? (
                                        <Input
                                            value={editTaskData.name || task.name}
                                            onChange={e => setEditTaskData({ ...editTaskData, name: e.target.value })}
                                            className="font-bold text-lg text-[#1d1d1f] w-full mb-1"
                                        />
                                    ) : (
                                        <h4 className="font-bold text-lg text-[#1d1d1f]">{task.name}</h4>
                                    )}
                                    {showAssignee && (
                                        <div className="flex flex-col gap-1 mt-0.5">
                                            <div className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest">Main Owner</div>
                                            <div className="text-sm font-medium text-[#0071e3]">{getEmployeeName(task.employee_id)}</div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-1.5 mt-2 overflow-hidden">
                                        <div key={task.employee_id} className="w-6 h-6 rounded-full bg-gradient-to-br from-[#1d1d1f] to-[#434343] flex items-center justify-center text-[8px] font-black text-white shadow-sm ring-1 ring-white" title={`Owner: ${getEmployeeName(task.employee_id)}`}>
                                            {getEmployeeName(task.employee_id).charAt(0)}
                                        </div>
                                        {(task.assignee_ids || []).map(id => (
                                            <div key={id} className="w-6 h-6 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center text-[8px] font-black text-[#1d1d1f] shadow-sm ring-1 ring-white -ml-2" title={`Collaborator: ${getEmployeeName(id)}`}>
                                                {getEmployeeName(id).charAt(0)}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <Badge variant={task.priority}>{task.priority}</Badge>
                                    {!showAssignee && task.status !== 'Completed' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateStatusFromModal(task.id, 'Completed');
                                            }}
                                            className="p-1.5 bg-[#f5f5f7] hover:bg-[#34c759]/10 text-[#86868b] hover:text-[#34c759] rounded-lg transition-all"
                                            title="Mark as Completed"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                        </button>
                                    )}
                                    {!showAssignee && !isEditing && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingTaskId(task.id);
                                                setEditTaskData({
                                                    ...task,
                                                    hours_spent: Number(task.hours_spent),
                                                    assignee_ids: task.assignee_ids || []
                                                });
                                            }}
                                            className="p-1.5 bg-[#f5f5f7] hover:bg-[#0071e3]/10 text-[#86868b] hover:text-[#0071e3] rounded-lg transition-all"
                                            title="Edit Task"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                                        </button>
                                    )}
                                    {!showAssignee && !isEditing && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteTask(task.id);
                                            }}
                                            className="p-1.5 bg-[#f5f5f7] hover:bg-[#ff3b30]/10 text-[#86868b] hover:text-[#ff3b30] rounded-lg transition-all"
                                            title="Delete Task"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                        </button>
                                    )}
                                    {showAssignee ? (
                                        <Badge variant={
                                            task.status === 'Completed' ? 'Low' :
                                                task.status === 'Blocked' ? 'Urgent' : 'default'
                                        }>
                                            {task.status}
                                        </Badge>
                                    ) : (
                                        <div className="w-1 h-5 bg-[#e5e5ea] rounded-full mx-1" />
                                    )}
                                </div>
                            </div>

                            <div className="text-sm text-[#86868b] mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4 font-medium">
                                <div className="flex items-center gap-2">
                                    <span className="uppercase text-[9px] font-black tracking-widest text-[#86868b]">Timeline</span>
                                    {isEditing ? (
                                        <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-[#e5e5ea] shadow-sm">
                                            <Input
                                                type="date"
                                                value={editTaskData.start_date}
                                                onChange={e => setEditTaskData({ ...editTaskData, start_date: e.target.value })}
                                                className="h-6 text-[10px] w-28 border-none p-0 focus-visible:ring-0 bg-transparent"
                                            />
                                            <span className="text-[10px] text-[#d2d2d7]">→</span>
                                            <Input
                                                type="date"
                                                value={editTaskData.deadline}
                                                onChange={e => setEditTaskData({ ...editTaskData, deadline: e.target.value })}
                                                className="h-6 text-[10px] w-28 border-none p-0 focus-visible:ring-0 bg-transparent"
                                            />
                                        </div>
                                    ) : (
                                        <span className="text-[#1d1d1f] font-bold">{task.start_date} - {task.deadline}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 lg:justify-end">
                                    <span className="uppercase text-[9px] font-black tracking-widest text-[#86868b]">Hours</span>
                                    {isEditing ? (
                                        <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-[#e5e5ea] shadow-sm">
                                            <Input
                                                type="number"
                                                value={editTaskData.hours_spent}
                                                onChange={e => setEditTaskData({ ...editTaskData, hours_spent: Number(e.target.value) })}
                                                className="w-12 h-6 text-[10px] font-bold text-[#0071e3] border-none p-0 focus-visible:ring-0 bg-transparent text-center"
                                            />
                                            <span className="text-[9px] font-bold text-[#86868b]">HRS</span>
                                        </div>
                                    ) : (
                                        <div className="px-2 py-0.5 bg-[#0071e3]/5 rounded-lg border border-[#0071e3]/10">
                                            <span className="text-[#0071e3] font-black">{task.hours_spent}h</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                {isEditing ? (
                                    <div className="space-y-3">
                                        <div className="space-y-1.5 px-3 py-2 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea]">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-[#86868b]">Collaborators</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {employees.filter(e => e.id !== userId).map(emp => {
                                                    const isSelected = editTaskData.assignee_ids?.includes(emp.id);
                                                    return (
                                                        <button
                                                            key={`edit-collab-${emp.id}`}
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const current = editTaskData.assignee_ids || [];
                                                                const next = isSelected 
                                                                    ? current.filter(id => id !== emp.id)
                                                                    : [...current, emp.id];
                                                                setEditTaskData({ ...editTaskData, assignee_ids: next });
                                                            }}
                                                            className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all border ${isSelected ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-sm' : 'bg-white text-[#86868b] border-[#e5e5ea] hover:bg-[#e5e5ea]'}`}
                                                        >
                                                            {emp.name}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <textarea
                                            value={editTaskData.notes}
                                            onChange={e => setEditTaskData({ ...editTaskData, notes: e.target.value })}
                                            className="w-full text-sm bg-[#f5f5f7] text-[#1d1d1f] p-3 rounded-lg border border-[#e5e5ea] min-h-[80px] outline-none focus:ring-1 focus:ring-[#0071e3]"
                                            placeholder="Add notes or updates..."
                                        />
                                        <div className="flex justify-end gap-2">
                                            <Button 
                                                variant="secondary" 
                                                className="h-8 py-0 px-3 text-[10px] font-bold border-[#d2d2d7]"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingTaskId(null);
                                                }}
                                            >
                                                CANCEL
                                            </Button>
                                            <Button 
                                                className="h-8 py-0 px-4 text-[10px] font-bold"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleUpdateTask(task.id);
                                                }}
                                            >
                                                SAVE CHANGES
                                            </Button>
                                        </div>
                                    </div>
                                ) : task.notes && (
                                    <div className="text-sm bg-[#f5f5f7] text-[#1d1d1f] p-3 rounded-lg border border-[#e5e5ea]">
                                        <div className="font-semibold text-xs uppercase text-[#86868b] mb-1">Notes / Update</div>
                                        {task.notes}
                                    </div>
                                )}

                                {/* Subtasks Section */}
                                {!showAssignee && (
                                    <div className="mt-4 pt-4 border-t border-[#e5e5ea]">
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="text-xs font-bold text-[#86868b] uppercase tracking-wider">Sub Tasks (Daily)</h5>
                                            <span className="text-[10px] text-[#86868b]">{subtasks.filter(s => s.is_completed).length}/{subtasks.length} Done</span>
                                        </div>

                                        <div className="space-y-2">
                                            {subtasks.map(subtask => (
                                                <div 
                                                    key={subtask.id} 
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="flex flex-col gap-2 p-2 rounded-lg hover:bg-white/50 transition-colors group"
                                                >
                                                    {editingSubtaskId === subtask.id ? (
                                                        <div className="flex flex-col gap-3 p-3 bg-white rounded-xl border border-[#0071e3]/20 shadow-sm">
                                                            <div className="flex items-center gap-2">
                                                                <Input
                                                                    value={editSubtaskData.name || ''}
                                                                    onChange={e => setEditSubtaskData({ ...editSubtaskData, name: e.target.value })}
                                                                    className="h-9 text-sm flex-1"
                                                                    placeholder="Activity name..."
                                                                />
                                                                 <Input
                                                                     type="date"
                                                                     value={editSubtaskData.date_logged || ''}
                                                                     onChange={e => setEditSubtaskData({ ...editSubtaskData, date_logged: e.target.value })}
                                                                     className="h-9 text-xs w-full sm:w-32"
                                                                 />
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 flex flex-col gap-2 bg-[#f5f5f7] px-3 py-1 rounded-lg border border-[#d2d2d7]">
                                                                    <div className="flex-1 flex flex-col">
                                                                        <span className="text-[8px] uppercase font-bold text-[#86868b]">Start</span>
                                                                        <Input
                                                                            type="time"
                                                                            value={editSubtaskData.start_time || '09:00'}
                                                                            onChange={e => {
                                                                                const start_time = e.target.value;
                                                                                const start = start_time.split(':').map(Number);
                                                                                const end = (editSubtaskData.end_time || '10:00').split(':').map(Number);
                                                                                let diff = (end[0] + end[1] / 60) - (start[0] + start[1] / 60);
                                                                                if (diff < 0) diff += 24;
                                                                                setEditSubtaskData({ ...editSubtaskData, start_time, hours_spent: Number(diff.toFixed(2)) });
                                                                            }}
                                                                            className="h-6 border-none p-0 text-sm focus-visible:ring-0 bg-transparent"
                                                                        />
                                                                    </div>
                                                                    <div className="text-[#d2d2d7]">→</div>
                                                                    <div className="flex-1 flex flex-col">
                                                                        <span className="text-[8px] uppercase font-bold text-[#86868b]">End</span>
                                                                        <Input
                                                                            type="time"
                                                                            value={editSubtaskData.end_time || '10:00'}
                                                                            onChange={e => {
                                                                                const end_time = e.target.value;
                                                                                const start = (editSubtaskData.start_time || '09:00').split(':').map(Number);
                                                                                const end = end_time.split(':').map(Number);
                                                                                let diff = (end[0] + end[1] / 60) - (start[0] + start[1] / 60);
                                                                                if (diff < 0) diff += 24;
                                                                                setEditSubtaskData({ ...editSubtaskData, end_time, hours_spent: Number(diff.toFixed(2)) });
                                                                            }}
                                                                            className="h-6 border-none p-0 text-sm focus-visible:ring-0 bg-transparent"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-center bg-[#f5f5f7] px-3 py-1 rounded-lg border border-[#d2d2d7] min-w-[60px]">
                                                                    <span className="text-[8px] uppercase font-bold text-[#86868b]">Total</span>
                                                                    <span className="text-xs font-bold text-[#0071e3]">{editSubtaskData.hours_spent || 0}h</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-end gap-2 mt-1">
                                                                <Button 
                                                                    className="h-8 px-3 text-xs bg-white text-[#1d1d1f] border border-[#d2d2d7] hover:bg-[#f5f5f7]"
                                                                    onClick={() => {
                                                                        setEditingSubtaskId(null);
                                                                        setEditSubtaskData({});
                                                                    }}
                                                                >
                                                                    Cancel
                                                                </Button>
                                                                <Button 
                                                                    className="h-8 px-4 text-xs bg-[#0071e3] text-white hover:bg-[#0077ed]"
                                                                    onClick={() => handleSaveSubtaskEdit(task.id)}
                                                                >
                                                                    Save
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={subtask.is_completed}
                                                                onChange={(e) => handleToggleSubtask(task.id, subtask.id, e.target.checked)}
                                                                className="w-4 h-4 rounded border-[#d2d2d7] text-[#0071e3] focus:ring-[#0071e3]"
                                                            />
                                                            <span className={`text-sm flex-1 ${subtask.is_completed ? 'text-[#86868b] line-through' : 'text-[#1d1d1f]'}`}>
                                                                {subtask.name}
                                                            </span>
                                                            <div className="flex flex-col items-end gap-1">
                                                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white rounded-md border border-[#e5e5ea] shadow-sm">
                                                                    <span className="text-[10px] font-bold text-[#0071e3]">{subtask.hours_spent}h</span>
                                                                    <div className="w-[1px] h-2 bg-[#d2d2d7]"></div>
                                                                    <span className="text-[9px] font-medium text-[#86868b] uppercase">{subtask.date_logged || 'No Date'}</span>
                                                                </div>
                                                                {subtask.start_time && subtask.end_time && (
                                                                    <span className="text-[9px] text-[#86868b] font-medium mr-1">{subtask.start_time} - {subtask.end_time}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingSubtaskId(subtask.id);
                                                                        setEditSubtaskData(subtask);
                                                                    }}
                                                                    className="opacity-0 group-hover:opacity-100 text-[#86868b] hover:text-[#0071e3] transition-all"
                                                                    title="Edit subtask"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteSubtask(task.id, subtask.id)}
                                                                    className="opacity-0 group-hover:opacity-100 text-[#86868b] hover:text-[#e83f3f] transition-all"
                                                                    title="Delete subtask"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}

                                            <div 
                                                onClick={(e) => e.stopPropagation()}
                                                className="flex flex-col gap-4 mt-4 p-4 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] shadow-sm"
                                            >
                                                <div className="flex flex-col sm:flex-row items-center gap-3">
                                                    <div className="flex-1 w-full">
                                                        <Input
                                                            placeholder="New daily activity..."
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
                                                            className="h-10 text-sm w-full"
                                                        />
                                                    </div>
                                                    <div className="w-full sm:w-32">
                                                        <Input
                                                            type="date"
                                                            value={newSubtaskData[task.id]?.date_logged || new Date().toISOString().split('T')[0]}
                                                            onChange={e => {
                                                                const date = e.target.value;
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
                                                                        date_logged: date
                                                                    }
                                                                }));
                                                            }}
                                                            className="h-10 text-xs w-full"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex flex-col sm:flex-row items-center gap-3">
                                                    <div className="flex-1 w-full flex items-center gap-2 bg-white px-3 py-1 rounded-lg border border-[#d2d2d7] shadow-sm">
                                                        <div className="flex-1 flex flex-col min-w-0">
                                                            <span className="text-[9px] uppercase font-bold text-[#86868b]">Start</span>
                                                            <Input
                                                                type="time"
                                                                value={newSubtaskData[task.id]?.start_time || '09:00'}
                                                                onChange={e => {
                                                                    const start_time = e.target.value;
                                                                    setNewSubtaskData(prev => {
                                                                        const current = prev[task.id] || { name: '', hours: 8, start_time: '09:00', end_time: '17:00', date_logged: new Date().toISOString().split('T')[0] };
                                                                        
                                                                        // Calculate hours
                                                                        const start = start_time.split(':').map(Number);
                                                                        const end = current.end_time.split(':').map(Number);
                                                                        let diff = (end[0] + end[1] / 60) - (start[0] + start[1] / 60);
                                                                        if (diff < 0) diff += 24;
                                                                        
                                                                        return {
                                                                            ...prev,
                                                                            [task.id]: { ...current, start_time, hours: Number(diff.toFixed(2)) }
                                                                        };
                                                                    });
                                                                }}
                                                                className="h-7 border-none p-0 text-sm focus-visible:ring-0"
                                                            />
                                                        </div>
                                                        <div className="text-[#d2d2d7]">→</div>
                                                        <div className="flex-1 flex flex-col min-w-0">
                                                            <span className="text-[9px] uppercase font-bold text-[#86868b]">End</span>
                                                            <Input
                                                                type="time"
                                                                value={newSubtaskData[task.id]?.end_time || '17:00'}
                                                                onChange={e => {
                                                                    const end_time = e.target.value;
                                                                    setNewSubtaskData(prev => {
                                                                        const current = prev[task.id] || { name: '', hours: 8, start_time: '09:00', end_time: '17:00', date_logged: new Date().toISOString().split('T')[0] };
                                                                        
                                                                        // Calculate hours
                                                                        const start = current.start_time.split(':').map(Number);
                                                                        const end = end_time.split(':').map(Number);
                                                                        let diff = (end[0] + end[1] / 60) - (start[0] + start[1] / 60);
                                                                        if (diff < 0) diff += 24;
                                                                        
                                                                        return {
                                                                            ...prev,
                                                                            [task.id]: { ...current, end_time, hours: Number(diff.toFixed(2)) }
                                                                        };
                                                                    });
                                                                }}
                                                                className="h-7 border-none p-0 text-sm focus-visible:ring-0"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 bg-white px-3 rounded-lg border border-[#d2d2d7] h-12 shadow-sm w-full sm:min-w-[70px]">
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[9px] uppercase font-bold text-[#86868b]">Total</span>
                                                            <div className="text-sm font-bold text-[#0071e3]">
                                                                {newSubtaskData[task.id]?.hours || 0}
                                                                <span className="ml-0.5 text-[10px] uppercase">Hrs</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleAddSubtask(task.id)}
                                                    className="w-full py-1.5 bg-[#0071e3] text-white rounded-lg font-bold text-[10px] hover:bg-[#0077ed] transition-colors"
                                                >
                                                    Add Log Entry
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // Team view data
    const teamTasks = allTasks.filter(t => t.employee_id !== userId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Data fetching for stats
    const tasksToday = myTasks.filter(t => t.created_at.split('T')[0] === new Date().toISOString().split('T')[0]);
    const hoursToday = tasksToday.reduce((sum, t) => sum + (t.hours_spent || 0), 0);
    const capacityLimit = 8;
    const capacityPercentage = Math.min((hoursToday / capacityLimit) * 100, 100);

    const completedTasksCount = myTasks.filter(t => t.status === 'Completed').length;
    const totalTasksCount = myTasks.length;
    const efficiencyPercentage = totalTasksCount > 0 ? (completedTasksCount / totalTasksCount) * 100 : 0;

    return (
        <div className="flex h-screen bg-[#f5f5f7] overflow-hidden">
            {/* --- MOBILE SIDEBAR (DRAWER) --- */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-[100] lg:hidden">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
                    <div className="absolute left-0 top-0 bottom-0 w-72 bg-white p-6 shadow-2xl animate-in slide-in-from-left duration-300">
                        <div className="flex items-center justify-between mb-10 px-2 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-[#0071e3] to-[#00c6ff] rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">
                                    {userName.charAt(0)}
                                </div>
                                <span className="text-xl font-black tracking-tight text-[#1d1d1f]">Empower</span>
                            </div>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-[#f5f5f7] rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-2 pb-10">
                            <NavItem icon="🏠" label="MY TASKS" active={activeTab === 'mine'} onClick={() => { setActiveTab('mine'); setIsMobileMenuOpen(false); }} />
                            <NavItem icon="👥" label="TEAM STATUS" active={activeTab === 'team'} onClick={() => { setActiveTab('team'); setIsMobileMenuOpen(false); }} />
                            <NavItem icon="⚙️" label="SETTINGS" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} />
                            
                            <div className="pt-6 pb-2">
                                <h4 className="px-4 text-[10px] font-black text-[#86868b] uppercase tracking-[0.2em] mb-4">Account</h4>
                                <Button variant="secondary" className="w-full flex items-center justify-start gap-3 px-4 py-3 rounded-xl text-[11px] font-black tracking-widest h-auto border-none bg-transparent hover:bg-[#f5f5f7]" onClick={() => window.location.href = '/'}>
                                    <span>🚪</span> LOGOUT
                                </Button>
                            </div>
                        </nav>
                        
                        <div className="mt-auto pt-6">
                            <div className="bg-[#f5f5f7] rounded-3xl p-5 border border-[#e5e5ea]">
                                <h4 className="text-[10px] font-black text-[#1d1d1f] uppercase tracking-widest mb-3">Daily Goal</h4>
                                <div className="flex items-end justify-between mb-2">
                                    <span className="text-xl font-black text-[#1d1d1f] tracking-tighter">{hoursToday}</span>
                                    <span className="text-[9px] font-bold text-[#86868b] mb-1">/ {capacityLimit} HRS</span>
                                </div>
                                <div className="h-1.5 w-full bg-[#e5e5ea] rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#0071e3] transition-all duration-1000 ease-out rounded-full"
                                        style={{ width: `${capacityPercentage}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- DESKTOP SIDEBAR --- */}
            <aside className="w-72 bg-white border-r border-[#e5e5ea] flex flex-col p-6 hidden lg:flex shrink-0">
                <div className="px-4">
                    <div className="flex items-center gap-3 px-2 mb-2">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#0071e3] to-[#00c6ff] rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg ring-4 ring-white">
                            {userName.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-[#1d1d1f] truncate w-32">{userName}</h2>
                            <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-tighter">Employee Hub</p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    <NavItem
                        label="DASHBOARD"
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>}
                        active={activeTab === 'mine'}
                        onClick={() => setActiveTab('mine')}
                    />
                    <NavItem
                        label="TEAM"
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
                        active={activeTab === 'team'}
                        onClick={() => setActiveTab('team')}
                    />
                    <NavItem
                        label="SETTINGS"
                        icon={<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>}
                        active={activeTab === 'settings'}
                        onClick={() => setActiveTab('settings')}
                    />
                </nav>

                <div className="px-6 mb-4">
                    <div className="bg-[#f5f5f7] rounded-3xl p-6 border border-[#e5e5ea]">
                        <h4 className="text-[10px] font-black text-[#1d1d1f] uppercase tracking-widest mb-4">Daily Goal</h4>
                        <div className="flex items-end justify-between mb-2">
                            <span className="text-2xl font-black text-[#1d1d1f] tracking-tighter">{hoursToday}</span>
                            <span className="text-[10px] font-bold text-[#86868b] mb-1">/ {capacityLimit} HRS</span>
                        </div>
                        <div className="h-2 w-full bg-[#e5e5ea] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-[#0071e3] transition-all duration-1000 ease-out rounded-full"
                                style={{ width: `${capacityPercentage}%` }}
                            />
                        </div>
                        <p className="text-[9px] font-bold text-[#86868b] mt-4 leading-relaxed">
                            {hoursToday >= capacityLimit ? "Goal achieved! Excellent work today." : `Log ${capacityLimit - hoursToday} more hours to reach your goal.`}
                        </p>
                    </div>
                </div>
            </aside>

            {/* --- MAIN CONTENT AREA --- */}
            <main className="flex-1 flex flex-col gap-6 overflow-hidden p-4 lg:p-0">
                <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#e5e5ea] flex items-center justify-between px-4 lg:px-8 sticky top-0 z-[40] -mx-4 lg:mx-0">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="lg:hidden p-2 hover:bg-[#f5f5f7] rounded-xl transition-colors"
                        >
                            <Menu size={20} />
                        </button>
                        <div>
                            <div className="text-[10px] font-bold text-[#86868b] uppercase tracking-[0.2em] mb-1 flex items-center gap-2">
                                <span className="hidden sm:inline">PAGES</span>
                                <span className="hidden sm:inline text-[#d2d2d7]">/</span>
                                <span className="text-[#1d1d1f] tracking-tight">{activeTab.toUpperCase()}</span>
                            </div>
                            <h1 className="text-lg lg:text-xl font-black text-[#1d1d1f] tracking-tight capitalize truncate max-w-[150px] sm:max-w-none">
                                {activeTab === 'mine' ? 'My Workspace' : activeTab === 'team' ? 'Team Feed' : 'Account Settings'}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative group hidden sm:block">
                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[#86868b]">
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-[#f5f5f7] border-none rounded-2xl text-[11px] font-bold text-[#1d1d1f] outline-none w-40 lg:w-64 focus:ring-2 focus:ring-[#0071e3]/20 transition-all placeholder-[#86868b]"
                            />
                        </div>
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="p-2.5 bg-[#f5f5f7] hover:bg-[#e5e5ea] text-[#1d1d1f] rounded-2xl transition-all relative"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                                {unreadCount > 0 && (
                                    <span className="absolute top-2 right-2 w-2 h-2 bg-[#ff3b30] rounded-full ring-2 ring-white animate-pulse"></span>
                                )}
                            </button>

                            {showNotifications && (
                                <div className="absolute right-0 mt-3 w-[calc(100vw-32px)] sm:w-80 bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-[#e5e5ea] z-50 overflow-hidden fade-in">
                                    <div className="p-5 border-b border-[#f5f5f7] flex justify-between items-center bg-[#f5f5f7]/50">
                                        <div className="flex flex-col">
                                            <h3 className="font-black text-xs uppercase tracking-widest text-[#1d1d1f]">Notifications</h3>
                                            <button 
                                                onClick={async () => {
                                                    await markAllNotificationsAsRead(userId);
                                                    refreshData();
                                                }}
                                                className="text-[10px] font-bold text-[#0071e3] uppercase tracking-tighter text-left hover:text-[#005bb7] transition-colors"
                                            >
                                                Mark all read
                                            </button>
                                        </div>
                                        {unreadCount > 0 && <Badge variant="Urgent">{unreadCount} New</Badge>}
                                    </div>
                                    <div className="max-h-[400px] overflow-y-auto">
                                        {notifications.length === 0 ? (
                                            <div className="p-10 text-center text-[#86868b] text-xs font-bold italic">No notifications yet</div>
                                        ) : (
                                            notifications.map(n => (
                                                <div
                                                    key={n.id}
                                                    onClick={() => handleMarkAsRead(n)}
                                                    className={`p-4 border-b border-[#f5f5f7] hover:bg-[#f5f5f7] cursor-pointer transition-colors ${!n.is_read ? 'bg-[#0071e3]/5' : ''}`}
                                                >
                                                    <div className="flex gap-3">
                                                        <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                                                            n.type === 'urgent' ? 'bg-[#ff3b30]' : 
                                                            n.type === 'overdue' ? 'bg-[#ff9500]' : 'bg-[#0071e3]'
                                                        }`} />
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className="text-[10px] font-black uppercase text-[#86868b] tracking-tighter">
                                                                    {n.type}
                                                                </span>
                                                                <span className="text-[9px] text-[#86868b] font-medium">
                                                                    {new Date(n.created_at).toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] font-bold text-[#1d1d1f] leading-snug">{n.message}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    {notifications.length > 0 && (
                                        <div className="p-4 bg-[#f5f5f7]/30 border-t border-[#f5f5f7] text-center">
                                            <button 
                                                onClick={async () => {
                                                    if (confirm("Clear all notifications?")) {
                                                        await clearNotifications(userId);
                                                        refreshData();
                                                    }
                                                }}
                                                className="text-[10px] font-black text-[#0071e3] uppercase tracking-widest hover:text-[#005bb7] transition-colors"
                                            >
                                                Clear All
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {activeTab === 'settings' ? (
                        <div className="max-w-4xl mx-auto fade-in space-y-8 pb-10">
                            <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 px-4 text-center sm:text-left">
                                <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-[#0071e3] to-[#00c6ff] rounded-2xl flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-lg">
                                    {userName.charAt(0)}
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-2xl sm:text-3xl font-extrabold text-[#1d1d1f] truncate">{userName}</h3>
                                    <p className="text-[#86868b] font-semibold text-base sm:text-lg">Employee Account</p>
                                </div>
                            </div>

                            {profileMsg && (
                                <div className={`mx-4 p-4 rounded-2xl text-sm font-bold shadow-sm border ${profileMsg.type === 'success' ? 'bg-[#f2fdf5] text-[#1a7f37] border-[#d1fadf]' : 'bg-[#fff5f5] text-[#d93025] border-[#fde8e8]'}`}>
                                    <div className="flex items-center gap-2">
                                        {profileMsg.type === 'success' ? '✅' : '⚠️'}
                                        {profileMsg.text}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
                                {/* Profile Info */}
                                <Card className="p-6 sm:p-8 border-[#e5e5ea] shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 mb-6 sm:mb-8">
                                        <div className="p-2 bg-[#f5f5f7] rounded-lg">👤</div>
                                        <h4 className="text-lg sm:text-xl font-bold text-[#1d1d1f]">Account Details</h4>
                                    </div>
                                    <form onSubmit={handleUpdateProfile} className="space-y-6">
                                        <div>
                                            <label className="block text-[10px] sm:text-xs font-black uppercase tracking-widest mb-2 text-[#86868b]">Display Name</label>
                                            <Input
                                                value={profileName}
                                                onChange={e => setProfileName(e.target.value)}
                                                className="w-full h-12 text-base sm:text-lg font-medium"
                                                placeholder="Enter your name"
                                            />
                                        </div>
                                        <div className="pt-2">
                                            <Button type="submit" disabled={isUpdatingProfile} className="w-full h-12 text-sm sm:text-md font-bold">
                                                {isUpdatingProfile ? 'Updating...' : 'Update Name'}
                                            </Button>
                                        </div>
                                    </form>
                                </Card>

                                {/* Security */}
                                <Card className="p-8 border-[#e5e5ea] shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="p-2 bg-[#f5f5f7] rounded-lg">🔒</div>
                                        <h4 className="text-xl font-bold text-[#1d1d1f]">Security</h4>
                                    </div>
                                    <form onSubmit={handleChangePassword} className="space-y-6">
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest mb-2 text-[#86868b]">New Password</label>
                                            <Input
                                                type="password"
                                                placeholder="At least 6 characters"
                                                value={passwords.new}
                                                onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                                                className="w-full h-12 text-sm sm:text-base"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-widest mb-2 text-[#86868b]">Confirm New Password</label>
                                            <Input
                                                type="password"
                                                placeholder="Repeat new password"
                                                value={passwords.confirm}
                                                onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                                                className="w-full h-12 text-sm sm:text-base"
                                            />
                                        </div>
                                        <div className="pt-2">
                                            <Button type="submit" variant="secondary" disabled={isUpdatingPassword} className="w-full h-12 text-sm sm:text-md font-bold border-[#d2d2d7] hover:bg-[#f5f5f7]">
                                                {isUpdatingPassword ? 'Updating...' : 'Change Password'}
                                            </Button>
                                        </div>
                                    </form>
                                </Card>
                            </div>
                        </div>
                    ) : activeTab === 'mine' ? (
                        <div className="fade-in space-y-8">
                            {/* Active Tasks */}
                            <div>
                                <div className="flex items-center gap-3 mb-6 px-2">
                                    <h3 className="text-2xl font-bold text-[#1d1d1f]">Active Workspace</h3>
                                    <Badge variant="default" className="bg-[#0071e3]/10 text-[#0071e3] border-none font-black uppercase tracking-widest text-[10px]">
                                        {myTasks.filter(t => t.status !== 'Completed').length} ACTIVE
                                    </Badge>
                                </div>
                                {renderTaskList(myTasks.filter(t => t.status !== 'Completed' && (t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()))), false)}
                            </div>

                            {/* Completed Tasks */}
                            {myTasks.some(t => t.status === 'Completed') && (
                                <div className="pt-8 border-t border-[#e5e5ea]">
                                    <div className="flex items-center gap-3 mb-6 px-2">
                                        <h3 className="text-2xl font-bold text-[#86868b]">Completion History</h3>
                                        <Badge variant="Low" className="font-black uppercase tracking-widest text-[10px]">
                                            {myTasks.filter(t => t.status === 'Completed').length} COMPLETED
                                        </Badge>
                                    </div>
                                    <div className="opacity-75 grayscale-[0.5] hover:opacity-100 hover:grayscale-0 transition-all duration-300">
                                        {renderTaskList(myTasks.filter(t => t.status === 'Completed' && (t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()))), false)}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Team View */
                        <div className="max-w-4xl mx-auto fade-in">
                            <Card className="bg-[#f0f9ff] border-[#bae6fd] mb-6 shadow-sm">
                                <div className="flex gap-4 items-center">
                                    <div className="text-4xl">🌐</div>
                                    <div>
                                        <h3 className="text-xl font-bold text-[#1d1d1f]">Team Activity Board</h3>
                                        <p className="text-[#0071e3] font-medium text-sm">See what the rest of the team is working on in real-time. Read-only view.</p>
                                    </div>
                                </div>
                            </Card>
                            {renderTaskList(allTasks.filter(t => t.employee_id !== userId && (t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()))), true)}
                        </div>
                    )}
                </div>
            </main>

            {/* --- RIGHT STATS PANEL --- */}
            <aside className="w-80 overflow-y-auto pr-2 hidden xl:block border-l border-[#e5e5ea] pl-6">
                <div className="flex flex-col gap-8 py-4">
                    {/* Efficiency Chart */}
                    <Card className="p-8 flex flex-col items-center bg-white shadow-[0_4px_24px_rgba(0,0,0,0.03)] border-[#e5e5ea] rounded-3xl">
                        <h4 className="text-[11px] font-black text-[#1d1d1f] uppercase tracking-[0.2em] mb-8">Performance</h4>
                        <CircularProgress percentage={efficiencyPercentage} color="#0071e3" />
                        <div className="grid grid-cols-2 gap-4 w-full mt-10">
                            <div className="bg-[#f5f5f7] p-4 rounded-2xl flex flex-col items-center">
                                <span className="text-[9px] font-bold text-[#86868b] uppercase tracking-widest mb-1">TOTAL</span>
                                <span className="text-xl font-black text-[#1d1d1f] tracking-tighter">{totalTasksCount}</span>
                                <div className="w-4 h-1 bg-[#0071e3] rounded-full mt-2"></div>
                            </div>
                            <div className="bg-[#f5f5f7] p-4 rounded-2xl flex flex-col items-center">
                                <span className="text-[9px] font-bold text-[#86868b] uppercase tracking-widest mb-1">DONE</span>
                                <span className="text-xl font-black text-[#1d1d1f] tracking-tighter">{completedTasksCount}</span>
                                <div className="w-4 h-1 bg-[#34c759] rounded-full mt-2"></div>
                            </div>
                        </div>
                    </Card>

                    {/* Log New Task (Moved to Sidebar) */}
                    <Card className="border border-[#e5e5ea] p-6 shadow-sm">
                        <h3 className="text-sm font-black mb-4 text-[#1d1d1f] uppercase tracking-widest">Log New Task</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold mb-1 text-[#86868b] uppercase">Task Name</label>
                                <Input
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Task name"
                                    className={`h-10 text-xs ${error ? 'border-red-500' : ''}`}
                                />
                                {error && (
                                    <p className="mt-1 text-[9px] font-black text-red-500 uppercase tracking-tight animate-in fade-in slide-in-from-top-1">
                                        {error}
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-col gap-4">
                                <div>
                                    <label className="block text-[10px] font-bold mb-1 text-[#86868b] uppercase">Start Date</label>
                                    <Input
                                        type="date"
                                        required
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                        className="h-10 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold mb-1 text-[#86868b] uppercase">Deadline</label>
                                    <Input
                                        type="date"
                                        required
                                        value={formData.deadline}
                                        onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                        className="h-10 text-xs"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[10px] font-bold mb-1 text-[#86868b] uppercase">Priority</label>
                                    <Select
                                        value={formData.priority}
                                        onChange={e => setFormData({ ...formData, priority: e.target.value as Priority })}
                                        className="h-9 text-[10px]"
                                    >
                                        <option>Low</option>
                                        <option>Medium</option>
                                        <option>High</option>
                                        <option>Urgent</option>
                                    </Select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold mb-1 text-[#86868b] uppercase">Status</label>
                                    <Select
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value as Status })}
                                        className="h-9 text-[10px]"
                                    >
                                        <option>To Do</option>
                                        <option>In Progress</option>
                                        <option>Blocked</option>
                                        <option>Completed</option>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold mb-2 text-[#86868b] uppercase tracking-widest">Collaborators</label>
                                <div className="flex flex-wrap gap-1.5 p-3 bg-[#f5f5f7] rounded-xl border border-[#d2d2d7]">
                                    {employees.filter(e => e.id !== userId).map(emp => {
                                        const isSelected = formData.assignee_ids?.includes(emp.id);
                                        return (
                                            <button
                                                key={`create-collab-${emp.id}`}
                                                type="button"
                                                onClick={() => {
                                                    const current = formData.assignee_ids || [];
                                                    const next = isSelected 
                                                        ? current.filter(id => id !== emp.id)
                                                        : [...current, emp.id];
                                                    setFormData({ ...formData, assignee_ids: next });
                                                }}
                                                className={`px-2 py-1 rounded-lg text-[9px] font-black transition-all border ${isSelected ? 'bg-[#0071e3] text-white border-[#0071e3] shadow-sm' : 'bg-white text-[#86868b] border-[#e5e5ea] hover:bg-[#e5e5ea]'}`}
                                            >
                                                {emp.name}
                                            </button>
                                        );
                                    })}
                                    {employees.filter(e => e.id !== userId).length === 0 && (
                                        <span className="text-[9px] text-[#86868b] italic">No other team members found.</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold mb-1 text-[#86868b] uppercase">Notes</label>
                                <textarea
                                    className="w-full bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] rounded-xl px-3 py-2 text-xs outline-none focus:border-[#0071e3] min-h-[60px]"
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Brief details..."
                                />
                            </div>

                            <Button type="submit" className="w-full h-10 text-xs font-bold" disabled={loading}>
                                {loading ? 'Saving...' : 'Log Activity'}
                            </Button>
                        </form>
                    </Card>

                    {/* Weekly Tip */}
                    <div className="p-6 bg-[#f5f5f7] rounded-3xl border border-[#e5e5ea]">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-8 h-8 bg-white rounded-lg shadow-sm flex items-center justify-center text-lg">💡</div>
                            <h5 className="text-[10px] font-black text-[#1d1d1f] uppercase tracking-widest">Efficiency Tip</h5>
                        </div>
                        <p className="text-[11px] font-bold text-[#86868b] leading-relaxed italic">
                            "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus."
                        </p>
                    </div>
                </div>
            </aside>
            {/* --- TASK DETAILS MODAL --- */}
            {selectedTask && (
                <TaskDetailsModal
                    task={selectedTask.task}
                    subtasks={selectedTask.subtasks}
                    onClose={() => setSelectedTask(null)}
                    onUpdateStatus={handleUpdateStatusFromModal}
                    isEditable={activeTab === 'mine'}
                    currentUserId={userId}
                    refreshData={refreshData}
                    employees={employees}
                />
            )}
        </div>
    );
}
