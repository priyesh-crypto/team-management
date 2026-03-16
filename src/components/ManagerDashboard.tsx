"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Task, Subtask, Profile, Priority, Status, Project, getTasks, getProfiles, getProjects, saveTask, inviteMember, updateEmployeeProfile, updateUserPassword, updateOwnPassword, updateTaskStatus, deleteTask, getSubtasks, getBulkSubtasks, updateProfile, changePassword, updateTask, getNotifications, markNotificationAsRead, markAllNotificationsAsRead, clearNotifications, Notification, deleteEmployee, sendAlert, updateSubtask, updateSubtaskStatus, getBulkCounts, getAttachments, Attachment, getWorkloadHeatmap, WorkloadMap, AuditLog, getTaskAuditLog, getMemberActivity, getOrgActivityFeed } from '@/app/actions/actions';
import { formatAuditEntry } from '@/utils/audit-formatters';
import { useRouter } from 'next/navigation';
import { Card, Select, Badge, Button, Input } from '@/components/ui/components';
import { TaskDetailsModal } from '@/components/ui/TaskDetailsModal';
import TimelineSchedule from '@/components/ui/TimelineSchedule';
import { WorkloadHeatmap } from '@/components/WorkloadHeatmap';
import { DigestSettings } from '@/components/DigestSettings';
import { ProjectSwitcher } from '@/components/ProjectSwitcher';
import { Pencil, Trash2, Menu, X, Calendar, Clock } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function ManagerDashboard({ userId, userName, projectId, userRole }: { userId: string, userName: string, projectId?: string, userRole: 'employee' | 'manager' }) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'board' | 'mine' | 'planning' | 'team' | 'settings'>('board');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTask, setSelectedTask] = useState<{ task: Task, subtasks: Subtask[] } | null>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Data State
    const [tasks, setTasks] = useState<Task[]>([]); // This will hold all tasks
    const [employees, setEmployees] = useState<Profile[]>([]); // organization wide
    const [projectMembers, setProjectMembers] = useState<Profile[]>([]); // project specific
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [subtasksMap, setSubtasksMap] = useState<Record<string, Subtask[]>>({});
    const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
    const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

    // Profile State
    const [profileName, setProfileName] = useState(userName);
    const [passwords, setPasswords] = useState({ new: '', confirm: '' });
    const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    // Team Management Form State
    const [inviteForm, setInviteForm] = useState({ email: '', role: 'employee' });
    const [inviteResult, setInviteResult] = useState<{type: 'error' | 'success', text: string} | null>(null);
    const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
    const [editEmpForm, setEditEmpForm] = useState({ name: '', role: 'employee', password: '' });
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [workloadData, setWorkloadData] = useState<WorkloadMap>({});
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [broadcastForm, setBroadcastForm] = useState({ message: '', type: 'system' as 'urgent' | 'system' });
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [deletingEmpId, setDeletingEmpId] = useState<string | null>(null);
    const [empStatusMsg, setEmpStatusMsg] = useState<{ id: string, text: string } | null>(null);
    const [assignError, setAssignError] = useState<string | null>(null);
    const [showEmployeeDeleteConfirm, setShowEmployeeDeleteConfirm] = useState(false);
    const [employeeToDelete, setEmployeeToDelete] = useState<{ id: string, name: string } | null>(null);

    // Custom Task Delete State
    const [isDeletingTask, setIsDeletingTask] = useState(false);

    // Notification Click-Outside Ref
    const notificationRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        }
        if (showNotifications) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [showNotifications]);
    const [showTaskDeleteConfirm, setShowTaskDeleteConfirm] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<{ id: string, name: string } | null>(null);

    // Assign Task State (used in a modal or side panel later maybe, but for now in board)
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignForm, setAssignForm] = useState<Partial<Task>>({
        name: '',
        employee_id: '',
        assignee_ids: [],
        project_id: projectId || '',
        start_date: new Date().toISOString().split('T')[0],
        deadline: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        priority: 'Medium',
        status: 'To Do',
        notes: ''
    });

    // Personal Task Logging State (from EmployeeDashboard)
    const [logForm, setLogForm] = useState({
        name: '',
        project_id: projectId || '',
        start_date: new Date().toISOString().split('T')[0],
        deadline: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        priority: 'Medium' as Priority,
        status: 'To Do' as Status,
        notes: '',
        hours_spent: 0,
        assignee_ids: [] as string[]
    });
    const [activeTimers, setActiveTimers] = useState<Record<string, string>>({});
    const [now, setNow] = useState(new Date());
    const [isSavingLog, setIsSavingLog] = useState(false);
    const [logError, setLogError] = useState<string | null>(null);

    // Editing State (for personal tasks)
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editTaskData, setEditTaskData] = useState<Partial<Task>>({});
    const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
    const [editSubtaskData, setEditSubtaskData] = useState<Partial<Subtask>>({});
    const [newSubtaskData, setNewSubtaskData] = useState<Record<string, { name: string, hours: number, date_logged: string, start_time: string, end_time: string }>>({});

    useEffect(() => {
        const saved = localStorage.getItem('activeTimers');
        if (saved) {
            try {
                setActiveTimers(JSON.parse(saved));
            } catch (e) {
                console.error("Error loading timers:", e);
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('activeTimers', JSON.stringify(activeTimers));
    }, [activeTimers]);

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        refreshData();

        // Initialize Supabase client for real-time
        const supabase = createClient();
        
        // Subscribe to tasks, subtasks, profiles, and notifications
        const taskChannel = supabase
            .channel('manager-dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                refreshData(true);
                router.refresh();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, () => {
                refreshData(true);
                router.refresh();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                refreshData(true);
                router.refresh();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
                refreshData(true);
                router.refresh();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
                refreshData(true);
                router.refresh();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments' }, () => {
                refreshData(true);
                router.refresh();
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => {
                refreshAuditLogs();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(taskChannel);
        };
    }, []);

    const refreshAuditLogs = async () => {
        try {
            // Use existing tasks to get orgId if possible
            const targetOrgId = tasks[0]?.org_id;
            if (targetOrgId) {
                const logs = await getOrgActivityFeed(targetOrgId);
                setAuditLogs(logs);
                return;
            }
            
            // Fallback to fetching tasks if state is empty
            const fetchedTasks = await getTasks();
            if (fetchedTasks.length > 0) {
                const logs = await getOrgActivityFeed(fetchedTasks[0].org_id);
                setAuditLogs(logs);
            }
        } catch (error) {
            console.error("Error fetching audit logs:", error);
        }
    };

    const refreshData = async (silent = true) => {
        if (!silent) setLoading(true);
        try {
            const [fetchedTasks, fetchedProfiles, fetchedProjects, fetchedProjectMembers] = await Promise.all([
                getTasks(projectId), 
                getProfiles(),
                getProjects(),
                projectId ? getProfiles(projectId) : Promise.resolve([])
            ]);
            setTasks(fetchedTasks);
            setEmployees(fetchedProfiles);
            setProjects(fetchedProjects);
            setProjectMembers(fetchedProjectMembers);

            // Fetch Audit Logs
            if (fetchedTasks.length > 0) {
                const logs = await getOrgActivityFeed(fetchedTasks[0].org_id);
                setAuditLogs(logs);
            }
            
            // Sync selected task if it's open
            if (selectedTask) {
                const refreshedTask = fetchedTasks.find(t => t.id === selectedTask.task.id);
                if (refreshedTask) {
                    const subtasks = await getSubtasks(refreshedTask.id);
                    setSelectedTask({ task: refreshedTask, subtasks });
                }
            }

            // Fetch all subtasks in bulk for better performance
            const taskIds = fetchedTasks.map(t => t.id);
            const allSubtasks = await getBulkSubtasks(taskIds);
            
            const newMap: Record<string, Subtask[]> = {};
            allSubtasks.forEach(st => {
                if (!newMap[st.task_id]) newMap[st.task_id] = [];
                newMap[st.task_id].push(st);
            });
            setSubtasksMap(newMap);

            // Fetch counts for comments and attachments
            const counts = await getBulkCounts(taskIds);
            setCommentCounts(counts.comments);
            setAttachmentCounts(counts.attachments);

            // Fetch workload data
            const workload = await getWorkloadHeatmap(projectId);
            setWorkloadData(workload);

            return { tasks: fetchedTasks, profiles: fetchedProfiles };
        } catch (error) {
            console.error("Error refreshing dashboard data:", error);
            return { tasks: [], profiles: [] };
        } finally {
            setLoading(false);
        }
    };

    // --- Timeline Logic ---
    const timelineData = useMemo(() => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);

        if (viewMode === 'day') {
            start.setDate(start.getDate() - 1);
            end.setDate(end.getDate() + 2);
        } else if (viewMode === 'month') {
            start.setDate(start.getDate() - 5);
            end.setDate(end.getDate() + 25);
        } else {
            // Default: Week (approx 2 weeks)
            start.setDate(start.getDate() - 2);
            end.setDate(end.getDate() + 12);
        }

        const days = [];
        let curr = new Date(start);
        while (curr <= end) {
            days.push(new Date(curr));
            curr.setDate(curr.getDate() + 1);
        }

        // Group tasks by employee
        const employeeTasks: Record<string, Task[]> = {};
        employees.filter(e => e.role === 'employee').forEach(emp => {
            employeeTasks[emp.id] = tasks.filter(t => t.employee_id === emp.id);
        });

        return { days, employeeTasks, startDate: start, endDate: end };
    }, [tasks, employees, viewMode]);


    const handleEmployeeActivityClick = (employee: Profile) => {
        setSearchQuery(employee.name);
        setActiveTab('board');
        // Scroll to top to ensure the search results are visible
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleTaskClick = async (task: Task) => {
        const subtasks = await getSubtasks(task.id);
        setSelectedTask({ task, subtasks });
    };

    const handleLogSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLogError(null);
        setIsSavingLog(true);

        const newTaskData = {
            ...logForm,
            employee_id: userId,
            hours_spent: Number(logForm.hours_spent),
        };

        try {
            const result = await saveTask(newTaskData);
            if (result.success) {
                setLogForm({
                    name: '',
                    project_id: projectId || '',
                    start_date: new Date().toISOString().split('T')[0],
                    deadline: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                    priority: 'Medium',
                    status: 'To Do',
                    notes: '',
                    hours_spent: 0,
                    assignee_ids: []
                });
                refreshData();
            } else {
                setLogError(result.error || 'Failed to save task.');
            }
        } catch (err: any) {
            setLogError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsSavingLog(false);
        }
    };

    const formatElapsed = (startTimeIso: string) => {
        const start = new Date(startTimeIso);
        const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
        if (diff < 0) return "00:00:00";
        const h = Math.floor(diff / 3600);
        const m = Math.floor((diff % 3600) / 60);
        const s = diff % 60;
        return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
    };

    const handleStartTimer = (subtaskId: string, taskId: string) => {
        setActiveTimers(prev => ({ ...prev, [subtaskId]: new Date().toISOString() }));
    };

    const handleStopTimer = async (subtaskId: string, taskId: string) => {
        const startTimeIso = activeTimers[subtaskId];
        if (!startTimeIso) return;

        const start = new Date(startTimeIso);
        const end = new Date();
        const diffHrs = Number(((end.getTime() - start.getTime()) / (1000 * 3600)).toFixed(2));

        const formatTime = (date: Date) => {
            return date.getHours().toString().padStart(2, '0') + ':' + date.getMinutes().toString().padStart(2, '0');
        };

        if (subtaskId.startsWith('new-')) {
            // Timer for a new work log entry
            setNewSubtaskData(prev => {
                const current = prev[taskId] || { 
                    name: '', 
                    hours: 0, 
                    start_time: formatTime(start), 
                    end_time: formatTime(end), 
                    date_logged: new Date().toISOString().split('T')[0] 
                };
                return {
                    ...prev,
                    [taskId]: {
                        ...current,
                        start_time: formatTime(start),
                        end_time: formatTime(end),
                        hours: Number((current.hours + diffHrs).toFixed(2))
                    }
                };
            });
        } else {
            // Timer for an existing subtask
            const currentSubtasks = subtasksMap[taskId] || [];
            const subtask = currentSubtasks.find(s => s.id === subtaskId);
            if (subtask) {
                const totalHours = Number(((subtask.hours_spent || 0) + diffHrs).toFixed(2));
                try {
                    await updateSubtask({
                        id: subtaskId,
                        task_id: taskId,
                        hours_spent: totalHours,
                        start_time: subtask.start_time || formatTime(start),
                        end_time: formatTime(end)
                    });
                    refreshData(true);
                } catch (err) {
                    console.error("Failed to update subtask via timer:", err);
                }
            }
        }

        setActiveTimers(prev => {
            const next = { ...prev };
            delete next[subtaskId];
            return next;
        });
    };

    const handleUpdateTask = async (taskId: string) => {
        try {
            await updateTask(taskId, editTaskData);
            setEditingTaskId(null);
            refreshData(true);
        } catch (err: any) {
            alert(err.message || "Failed to update task.");
        }
    };

    const handleToggleSubtask = async (taskId: string, subtaskId: string, is_completed: boolean) => {
        try {
            // Optimistic update
            setSubtasksMap(prev => ({
                ...prev,
                [taskId]: (prev[taskId] || []).map(s => s.id === subtaskId ? { ...s, is_completed } : s)
            }));
            
            await updateSubtaskStatus(subtaskId, taskId, is_completed);
            refreshData(true);
        } catch (err: any) {
            console.error("Failed to toggle subtask:", err);
            refreshData(true);
        }
    };

    const handleAddSubtask = async (taskId: string) => {
        const data = newSubtaskData[taskId];
        if (!data || !data.name) return;

        try {
            await saveTask({
                task_id: taskId,
                name: data.name,
                hours_spent: Number(data.hours),
                date_logged: data.date_logged,
                start_time: data.start_time,
                end_time: data.end_time,
                employee_id: userId,
                is_subtask: true
            } as any);

            setNewSubtaskData(prev => ({ ...prev, [taskId]: { name: '', hours: 8, date_logged: new Date().toISOString().split('T')[0], start_time: '09:00', end_time: '17:00' } }));
            refreshData(true);
        } catch (err: any) {
            alert(err.message || "Failed to add work log.");
        }
    };

    const handleDeleteSubtask = async (taskId: string, subtaskId: string) => {
        if (!confirm("Are you sure you want to delete this work log?")) return;
        try {
            await deleteTask(subtaskId);
            refreshData(true);
        } catch (err: any) {
            alert(err.message || "Failed to delete subtask.");
        }
    };

    const handleSaveSubtaskEdit = async (taskId: string) => {
        if (!editingSubtaskId) return;
        try {
            await updateSubtask({
                id: editingSubtaskId,
                task_id: taskId,
                name: editSubtaskData.name,
                hours_spent: Number(editSubtaskData.hours_spent),
                date_logged: editSubtaskData.date_logged,
                start_time: editSubtaskData.start_time,
                end_time: editSubtaskData.end_time
            });
            setEditingSubtaskId(null);
            setEditSubtaskData({});
            refreshData(true);
        } catch (err: any) {
            alert(err.message || "Failed to update work log.");
        }
    };

    const getEmployeeName = (id: string) => {
        return employees.find(e => e.id === id)?.name || 'Unknown';
    };

    const handleUpdateStatusFromModal = async (taskId: string, status: Status) => {
        setIsUpdatingStatus(true);
        try {
            await updateTaskStatus(taskId, status);
            const { tasks: refreshedTasks } = await refreshData();
            
            // Update selected task in modal if it's the same one
            if (selectedTask && selectedTask.task.id === taskId) {
                const updatedTask = (refreshedTasks as Task[]).find((t: Task) => t.id === taskId); // Use the freshly fetched tasks
                if (updatedTask) {
                    const subtasks = await getSubtasks(taskId); // Re-fetch subtasks for the updated task
                    setSelectedTask({ task: updatedTask, subtasks: subtasks });
                }
            }
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const renderPersonalTaskList = (tasksList: Task[]) => {
        return (
            <div className="space-y-4">
                {tasksList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[32px] border-2 border-dashed border-[#eceef0]">
                        <div className="text-4xl mb-4">🎈</div>
                        <p className="text-[11px] font-black text-[#86868b] uppercase tracking-widest">No tasks found in this section</p>
                    </div>
                ) : (
                    tasksList.map(task => (
                        <Card key={task.id} className="p-6 rounded-[32px] border-[#eceef0] shadow-sm bg-white overflow-hidden group/task">
                            <div className="flex flex-col gap-6">
                                {/* Task Header */}
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            {editingTaskId === task.id ? (
                                                <input 
                                                    value={editTaskData.name || ''} 
                                                    onChange={e => setEditTaskData({ ...editTaskData, name: e.target.value })}
                                                    onBlur={() => handleUpdateTask(task.id)}
                                                    onKeyDown={e => e.key === 'Enter' && handleUpdateTask(task.id)}
                                                    autoFocus
                                                    className="text-base font-black text-[#1d1d1f] tracking-tight bg-[#f5f5f7] rounded-lg px-2 py-1 outline-none w-full"
                                                />
                                            ) : (
                                                <h4 className="text-base font-black text-[#1d1d1f] tracking-tight group-hover/task:text-[#0071e3] transition-colors flex items-center gap-2">
                                                    {task.name}
                                                    <button onClick={() => { setEditingTaskId(task.id); setEditTaskData(task); }} className="opacity-0 group-hover/task:opacity-100 text-[#d2d2d7] hover:text-[#0071e3] transition-all">
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
                                                                    <span className="text-[9px] font-bold text-[#86868b] uppercase tabular-nums">{subtask.date_logged || '2026-03-16'}</span>
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
                                                        onClick={() => handleDeleteSubtask(task.id, subtask.id)}
                                                        className="opacity-0 group-hover/sub:opacity-100 text-[#86868b] hover:text-[#ff3b30] transition-all p-1"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Rich Work Log Editor (Ported from Employee) */}
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
                                                            value={newSubtaskData[task.id]?.date_logged || new Date().toISOString().split('T')[0]}
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
                    ))
                )}
            </div>
        );
    };

    // --- Board Stats ---
    const boardStats = useMemo(() => {
        const filteredTasks = tasks.filter(t => 
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            employees.find(p => p.id === t.employee_id)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const groupTasksByStatus = (status: Status) => filteredTasks.filter(t => t.status === status);

        const total = filteredTasks.length;
        const completed = groupTasksByStatus('Completed').length;
        const inProgress = groupTasksByStatus('In Progress').length;
        const draft = groupTasksByStatus('To Do').length;
        const inReview = groupTasksByStatus('In Review').length;

        return { total, completed, inProgress, draft, inReview };
    }, [tasks, searchQuery, employees]);

    const heatmapData = useMemo(() => {
        const highUrgent = tasks.filter(t => t.priority === 'High' || t.priority === 'Urgent');
        const active = highUrgent.filter(t => t.status !== 'Completed' && new Date(t.deadline) >= new Date());
        const overdue = highUrgent.filter(t => t.status !== 'Completed' && new Date(t.deadline) < new Date());
        
        return { 
            active: active.map(t => ({ ...t, employee: employees.find(e => e.id === t.employee_id)?.name })), 
            overdue: overdue.map(t => ({ ...t, employee: employees.find(e => e.id === t.employee_id)?.name })) 
        };
    }, [tasks, employees]);

    // --- Handlers ---
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
        setIsUpdatingPassword(true);
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

    const handleInviteMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setInviteResult(null);
        try {
            await inviteMember(inviteForm.email, inviteForm.role);
            setInviteResult({ type: 'success', text: `Invitation sent to ${inviteForm.email}` });
            setInviteForm({ email: '', role: 'employee' });
            refreshData(); 
        } catch (err: any) {
            setInviteResult({ type: 'error', text: err.message || 'Failed to send invite.' });
        }
    };

    const handleSaveEdit = async (empId: string) => {
        try {
            await updateEmployeeProfile(empId, editEmpForm.name, editEmpForm.role);
            if (editEmpForm.password) {
                await updateUserPassword(empId, editEmpForm.password);
            }
            setEditingEmpId(null);
            setEditEmpForm({ name: '', role: 'employee', password: '' });
            refreshData();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleDeleteEmployee = async (e: React.MouseEvent, empId: string, empName: string) => {
        e.stopPropagation();
        setEmpStatusMsg(null);
        setEmployeeToDelete({ id: empId, name: empName });
        setShowEmployeeDeleteConfirm(true);
    };

    const confirmDeleteEmployee = async () => {
        if (!employeeToDelete) return;
        setDeletingEmpId(employeeToDelete.id);
        try {
            await deleteEmployee(employeeToDelete.id);
            setEmployees(prev => prev.filter(emp => emp.id !== employeeToDelete.id));
            setShowEmployeeDeleteConfirm(false);
            setEmployeeToDelete(null);
        } catch (err: any) {
            console.error("Delete employee error:", err);
            setEmpStatusMsg({ id: employeeToDelete.id, text: err.message || 'Failed to delete employee.' });
            setShowEmployeeDeleteConfirm(false);
        } finally {
            setDeletingEmpId(null);
        }
    };

    const cancelDeleteEmployee = () => {
        setShowEmployeeDeleteConfirm(false);
        setEmployeeToDelete(null);
        setDeletingEmpId(null);
    };

    const handleDeleteTask = (taskId: string, taskName: string) => {
        setTaskToDelete({ id: taskId, name: taskName });
        setShowTaskDeleteConfirm(true);
    };

    const confirmDeleteTask = async () => {
        if (!taskToDelete) return;
        setIsDeletingTask(true);
        try {
            await deleteTask(taskToDelete.id);
            await refreshData(true);
            setShowTaskDeleteConfirm(false);
            setTaskToDelete(null);
            // Close the details modal if it's open
            setSelectedTask(null);
        } catch (err: any) {
            alert(err.message || "Failed to delete task.");
        } finally {
            setIsDeletingTask(false);
        }
    };

    const cancelDeleteTask = () => {
        setShowTaskDeleteConfirm(false);
        setTaskToDelete(null);
    };

    const handleAssignTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignForm.employee_id || !assignForm.name) return;
        setAssignError(null);
        try {
            await saveTask(assignForm as any);
            setShowAssignModal(false);
            setAssignForm({ 
                name: '', 
                project_id: projectId || '',
                employee_id: '', 
                assignee_ids: [],
                start_date: new Date().toISOString().split('T')[0], 
                deadline: new Date(Date.now() + 86400000).toISOString().split('T')[0], 
                priority: 'Medium', 
                status: 'To Do', 
                notes: '' 
            });
            refreshData();
        } catch (err: any) {
            setAssignError(err.message || "Error assigning task");
        }
    };

    const handleBroadcastAlert = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!broadcastForm.message) return;
        setIsBroadcasting(true);
        try {
            await sendAlert('all', broadcastForm.message, broadcastForm.type as any);
            setShowBroadcastModal(false);
            setBroadcastForm({ message: '', type: 'system' });
            alert("Broadcast alert sent successfully!");
        } catch (err: any) {
            alert("Failed to send broadcast: " + err.message);
        } finally {
            setIsBroadcasting(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
                <div className="w-12 h-12 border-4 border-[#0071e3] border-t-transparent rounded-full animate-spin mb-4"></div>
                <div className="text-xl font-bold text-[#1d1d1f] animate-pulse">Initializing Management System...</div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#f5f5f7] overflow-hidden">
            {/* --- MOBILE SIDEBAR (DRAWER) --- */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-[100] lg:hidden">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
                    <div className="absolute left-0 top-0 bottom-0 w-72 bg-white p-6 shadow-2xl animate-in slide-in-from-left duration-300">
                        <div className="flex items-center justify-between mb-10 px-2">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#0071e3] rounded-xl flex items-center justify-center text-white font-black text-lg">MB</div>
                                <span className="text-xl font-black tracking-tight text-[#1d1d1f]">Mindbird.ai</span>
                            </div>
                            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-[#f5f5f7] rounded-xl">
                                <X size={20} />
                            </button>
                        </div>

                        <nav className="flex-1 space-y-2">
                            <NavItem icon="📊" label="DASHBOARD" active={activeTab === 'board'} onClick={() => { setActiveTab('board'); setIsMobileMenuOpen(false); }} />
                            <NavItem icon="🎯" label="MY TASKS" active={activeTab === 'mine'} onClick={() => { setActiveTab('mine'); setIsMobileMenuOpen(false); }} />
                            <NavItem icon="🗓️" label="PLANNING" active={activeTab === 'planning'} onClick={() => { setActiveTab('planning'); setIsMobileMenuOpen(false); }} />
                            <NavItem icon="👥" label="TEAM MGT" active={activeTab === 'team'} onClick={() => { setActiveTab('team'); setIsMobileMenuOpen(false); }} />
                            <NavItem icon="⚙️" label="SETTINGS" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} />
                            
                            <div className="mt-4 border-t border-[#f5f5f7] pt-2">
                                <ProjectSwitcher projects={projects} userRole={userRole} />
                            </div>
                        </nav>

                        <div className="mt-10 p-4 bg-[#f5f5f7] rounded-[24px] border border-[#e5e5ea]">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1d1d1f] to-[#434343] flex items-center justify-center text-xs text-white font-bold">
                                    {userName.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black truncate">{userName}</p>
                                    <p className="text-[10px] text-[#86868b] font-bold">Admin Privileges</p>
                                </div>
                            </div>
                            <Button variant="secondary" className="w-full text-[10px] font-black tracking-widest py-2 rounded-xl h-auto" onClick={() => window.location.href = '/'}>LOGOUT</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- DESKTOP SIDEBAR --- */}
            <div className="w-60 bg-white border-r border-[#e5e5ea] flex flex-col p-5 hidden lg:flex">
                <div className="flex items-center gap-3 mb-8 px-1">
                    <div className="w-8 h-8 bg-[#0071e3] rounded-lg flex items-center justify-center text-white font-black text-sm shadow-sm">MB</div>
                    <div>
                        <span className="text-sm font-black tracking-tight text-[#1d1d1f] leading-none block">Mindbird.ai</span>
                        <span className="text-[10px] text-[#86868b] uppercase tracking-widest font-bold">Pro Edition</span>
                    </div>
                </div>

                <nav className="flex-1 space-y-1.5">
                    <NavItem icon="📊" label="DASHBOARD" active={activeTab === 'board'} onClick={() => setActiveTab('board')} />
                    <NavItem icon="🎯" label="MY TASKS" active={activeTab === 'mine'} onClick={() => setActiveTab('mine')} />
                    <NavItem icon="🗓️" label="PLANNING" active={activeTab === 'planning'} onClick={() => setActiveTab('planning')} />
                    <NavItem icon="👥" label="TEAM MGT" active={activeTab === 'team'} onClick={() => setActiveTab('team')} />
                    <NavItem icon="⚙️" label="SETTINGS" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
                    
                    <div className="mt-4 border-t border-[#f5f5f7] pt-2">
                        <ProjectSwitcher projects={projects} userRole={userRole} />
                    </div>
                </nav>

                <div className="mt-auto p-5 bg-[#f5f5f7]/50 rounded-[32px] border border-[#e5e5ea]/50 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-2xl bg-[#0071e3] flex items-center justify-center text-xs font-black text-white shadow-lg shadow-[#0071e3]/20">
                            {userName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-black text-[#1d1d1f] truncate leading-tight uppercase tracking-wider">{userName}</p>
                            <p className="text-[9px] text-[#86868b] font-black uppercase tracking-widest mt-0.5">Administrator</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => window.location.href = '/'} 
                        className="w-full py-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-[#86868b] hover:text-[#ff3b30] transition-all border border-[#e5e5ea] rounded-xl bg-white hover:bg-[#fee2e2]/50 hover:border-[#fecaca] shadow-sm active:scale-95"
                    >
                        Sign Out
                    </button>
                </div>
            </div>

            {/* --- MAIN CONTENT --- */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-14 bg-white/80 backdrop-blur-md border-b border-[#e5e5ea] flex items-center justify-between px-6 lg:px-6 sticky top-0 z-[40]">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="lg:hidden p-2 hover:bg-[#f5f5f7] rounded-xl transition-colors"
                        >
                            <Menu size={18} />
                        </button>
                        <div className="hidden lg:block">
                            <h1 className="text-xs font-black text-[#1d1d1f] tracking-tight uppercase mb-0.5">
                                Welcome, {userName}
                            </h1>
                            <p className="text-[9px] font-black text-[#86868b] uppercase tracking-widest">
                                {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', weekday: 'long' })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex items-center gap-6 text-[10px] font-black tracking-[0.2em] text-[#86868b]">
                            <button className={`hover:text-[#1d1d1f] transition-colors ${activeTab === 'board' ? 'text-[#0071e3]' : ''}`} onClick={() => setActiveTab('board')}>BOARD</button>
                            <span className="opacity-20">•</span>
                            <button className="hover:text-[#1d1d1f] transition-colors" onClick={() => setActiveTab('planning')}>DAILY TASKS ▾</button>
                        </div>
                        <div className="relative group hidden sm:block">
                            <input 
                                placeholder="Find something..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-48 lg:w-64 bg-[#f5f5f7] border-none rounded-xl h-9 px-10 text-[11px] font-bold placeholder:text-[#86868b] placeholder:font-black focus:ring-2 ring-[#0071e3]/10 transition-all shadow-inner" 
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] opacity-40 group-focus-within:opacity-100 transition-opacity">🔍</span>
                        </div>
                        <button 
                            className="rounded-xl h-9 px-5 bg-black text-white font-black text-[9px] tracking-[0.2em] shadow-lg shadow-black/10 hover:bg-[#1d1d1f] transition-all hover:-translate-y-0.5 active:scale-95 uppercase" 
                            onClick={() => setShowAssignModal(true)}
                        >
                            + Create task
                        </button>
                        <div className="relative" ref={notificationRef}>
                            <div 
                                onClick={() => setShowNotifications(!showNotifications)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-base cursor-pointer transition-colors relative ${showNotifications ? 'bg-[#0071e3] text-white' : 'bg-[#f5f5f7] hover:bg-[#e5e5ea]'}`}
                            >
                                <span className="scale-90">🔔</span>
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#ff3b30] text-white text-[9px] font-black rounded-full flex items-center justify-center border border-white">
                                        {unreadCount}
                                    </span>
                                )}
                            </div>

                            {showNotifications && (
                                <Card className="absolute right-0 mt-4 w-96 p-0 rounded-[32px] shadow-2xl bg-white border-[#eceef0] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                    <div className="p-6 border-b border-[#f0f0f2] flex justify-between items-center bg-[#f5f5f7]/50">
                                        <div className="flex flex-col">
                                            <h3 className="text-sm font-black text-[#1d1d1f] tracking-tight uppercase">Notifications</h3>
                                            <button 
                                                onClick={async () => {
                                                    await markAllNotificationsAsRead(userId);
                                                    refreshData();
                                                }}
                                                className="text-[9px] font-black text-[#0071e3] uppercase tracking-widest text-left hover:text-[#005bb7] transition-colors"
                                            >
                                                Mark all as read
                                            </button>
                                        </div>
                                        {unreadCount > 0 && (
                                            <Badge className="bg-[#0071e3] text-white text-[9px] font-black border-none px-2 rounded-lg">
                                                {unreadCount} NEW
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
                                        {notifications.length === 0 ? (
                                            <div className="p-12 text-center">
                                                <div className="text-3xl mb-4 opacity-20">📭</div>
                                                <p className="text-[10px] font-black text-[#86868b] uppercase tracking-widest leading-loose">All caught up!<br/>No new notifications</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-[#f0f0f2]">
                                                {notifications.map((n) => (
                                                    <div 
                                                        key={n.id} 
                                                        onClick={async () => {
                                                            if (!n.is_read) {
                                                                await markNotificationAsRead(n.id);
                                                                refreshData();
                                                            }
                                                            if (n.task_id) {
                                                                const task = tasks.find(t => t.id === n.task_id);
                                                                if (task) {
                                                                    handleTaskClick(task);
                                                                    setShowNotifications(false);
                                                                }
                                                            }
                                                        }}
                                                        className={`p-6 hover:bg-[#f5f5f7] transition-all cursor-pointer group ${!n.is_read ? 'bg-[#0071e3]/[0.03]' : ''}`}
                                                    >
                                                        <div className="flex gap-3">
                                                            <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                                                                n.type === 'urgent' ? 'bg-[#ff3b30]' : 
                                                                n.type === 'overdue' ? 'bg-[#ff9500]' : 'bg-[#0071e3]'
                                                            }`} />
                                                            <div className="flex-1">
                                                                <div className="flex justify-between items-start mb-1">
                                                                    <span className="text-[10px] font-black text-[#1d1d1f] uppercase tracking-wider">{n.type}</span>
                                                                    <span className="text-[9px] font-bold text-[#86868b] tabular-nums">{new Date(n.created_at).toLocaleDateString()}</span>
                                                                </div>
                                                                <p className="text-xs font-bold text-[#424245] leading-relaxed group-hover:text-[#1d1d1f] transition-colors">{n.message}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {notifications.length > 0 && (
                                        <div className="p-4 bg-[#f5f5f7]/30 border-t border-[#f0f0f2]">
                                            <button 
                                                onClick={async () => {
                                                    if (confirm("Clear all notifications?")) {
                                                        await clearNotifications(userId);
                                                        refreshData();
                                                    }
                                                }}
                                                className="w-full py-2 text-[9px] font-black text-[#0071e3] uppercase tracking-widest hover:text-[#005bb7] transition-colors"
                                            >
                                                Clear all notifications
                                            </button>
                                        </div>
                                    )}
                                </Card>
                            )}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
                    {activeTab === 'board' && (
                        <div className="flex flex-col lg:flex-row gap-8">
                            {/* Board View */}
                            <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0">
                                <div className="flex gap-8 h-full min-w-max pb-4">
                                    <BoardColumn 
                                        title="TO DO" 
                                        tasks={tasks.filter(t => t.status === 'To Do' && (
                                            t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                            (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            employees.find(p => p.id === t.employee_id)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                                        ))} 
                                        subtasksMap={subtasksMap} 
                                        commentCounts={commentCounts} 
                                        attachmentCounts={attachmentCounts} 
                                        employees={employees} 
                                        onTaskClick={handleTaskClick} 
                                        onDeleteTask={handleDeleteTask} 
                                    />
                                    <BoardColumn 
                                        title="IN PROGRESS" 
                                        tasks={tasks.filter(t => t.status === 'In Progress' && (
                                            t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                            (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            employees.find(p => p.id === t.employee_id)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                                        ))} 
                                        subtasksMap={subtasksMap} 
                                        commentCounts={commentCounts} 
                                        attachmentCounts={attachmentCounts} 
                                        employees={employees} 
                                        onTaskClick={handleTaskClick} 
                                        onDeleteTask={handleDeleteTask} 
                                    />
                                    <BoardColumn 
                                        title="IN REVIEW" 
                                        tasks={tasks.filter(t => t.status === 'In Review' && (
                                            t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                            (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            employees.find(p => p.id === t.employee_id)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                                        ))} 
                                        subtasksMap={subtasksMap} 
                                        commentCounts={commentCounts} 
                                        attachmentCounts={attachmentCounts} 
                                        employees={employees} 
                                        onTaskClick={handleTaskClick} 
                                        onDeleteTask={handleDeleteTask} 
                                    />
                                    <BoardColumn 
                                        title="BLOCKED" 
                                        tasks={tasks.filter(t => t.status === 'Blocked' && (
                                            t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                            (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            employees.find(p => p.id === t.employee_id)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                                        ))} 
                                        subtasksMap={subtasksMap} 
                                        commentCounts={commentCounts} 
                                        attachmentCounts={attachmentCounts} 
                                        employees={employees} 
                                        onTaskClick={handleTaskClick} 
                                        onDeleteTask={handleDeleteTask} 
                                    />
                                    <BoardColumn 
                                        title="COMPLETED" 
                                        tasks={tasks.filter(t => t.status === 'Completed' && (
                                            t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                            (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            employees.find(p => p.id === t.employee_id)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                                        ))} 
                                        subtasksMap={subtasksMap} 
                                        commentCounts={commentCounts} 
                                        attachmentCounts={attachmentCounts} 
                                        employees={employees} 
                                        onTaskClick={handleTaskClick} 
                                        onDeleteTask={handleDeleteTask} 
                                    />
                                </div>
                            </div>

                            {/* Right Stats Panel */}
                            <div className="w-full lg:w-72 space-y-6 flex-shrink-0">
                                <Card className="p-6 rounded-[24px] bg-white border-[#eceef0] shadow-sm">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-[10px] font-black text-[#86868b] tracking-widest uppercase">Efficiency</h3>
                                        <Badge variant="secondary" className="bg-[#f0f0f2] text-[#1d1d1f] font-bold text-[8px]">2026</Badge>
                                    </div>
                                    
                                    <div className="flex flex-col items-center gap-6">
                                        <div className="relative w-32 h-32">
                                            <svg className="w-full h-full transform -rotate-90">
                                                <circle cx="64" cy="64" r="56" className="stroke-[#f0f0f2] stroke-[10] fill-none" />
                                                <circle 
                                                    cx="64" cy="64" r="56" 
                                                    className="stroke-[#0071e3] stroke-[10] fill-none transition-all duration-1000 ease-out"
                                                    style={{ 
                                                        strokeDasharray: '352',
                                                        strokeDashoffset: 352 - (352 * (boardStats.completed / (boardStats.total || 1)))
                                                    }}
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-2xl font-black text-[#1d1d1f]">{Math.round((boardStats.completed / (boardStats.total || 1)) * 100)}%</span>
                                                <span className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider">Done</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 w-full">
                                            <div className="p-3 bg-[#f5f5f7] rounded-2xl">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#0071e3]"></div>
                                                    <span className="text-[8px] font-bold text-[#86868b] tracking-wider uppercase">Total</span>
                                                </div>
                                                <p className="text-lg font-black">{boardStats.total}</p>
                                            </div>
                                            <div className="p-3 bg-[#f5f5f7] rounded-2xl">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#34c759]"></div>
                                                    <span className="text-[8px] font-bold text-[#86868b] tracking-wider uppercase">Done</span>
                                                </div>
                                                <p className="text-lg font-black">{boardStats.completed}</p>
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                <Card className="p-6 rounded-[24px] bg-white border-[#eceef0] shadow-sm">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-[10px] font-black text-[#86868b] tracking-widest uppercase">Hotspots</h3>
                                        <div className="w-1.5 h-1.5 rounded-full bg-[#ff3b30] animate-pulse"></div>
                                    </div>
                                    <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-wider mb-4 opacity-50">Critical Signals</p>
                                    
                                    <div className="space-y-4">
                                        <div className="p-3 bg-[#fff2f2] rounded-xl border border-[#ff3b30]/10">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-black text-[#ff3b30] uppercase tracking-widest">Overdue</span>
                                                <span className="text-base font-black text-[#ff3b30]">{heatmapData.overdue.length}</span>
                                            </div>
                                            <div className="h-1 w-full bg-[#ff3b30]/10 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-[#ff3b30] rounded-full transition-all duration-1000"
                                                    style={{ width: `${Math.min(100, (heatmapData.overdue.length / (heatmapData.active.length + heatmapData.overdue.length || 1)) * 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea]">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-black text-[#1d1d1f] uppercase tracking-widest">High/Urgent</span>
                                                <span className="text-base font-black text-[#1d1d1f]">{heatmapData.active.length}</span>
                                            </div>
                                            <div className="h-1 w-full bg-[#e5e5ea] rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-[#1d1d1f] rounded-full transition-all duration-1000"
                                                    style={{ width: `${Math.min(100, (heatmapData.active.length / (heatmapData.active.length + heatmapData.overdue.length || 1)) * 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <div className="pt-2 space-y-2">
                                            {heatmapData.overdue.slice(0, 3).map(t => (
                                                <div 
                                                    key={t.id} 
                                                    onClick={() => handleTaskClick(t)}
                                                    className="group cursor-pointer p-2.5 bg-[#fff2f2]/50 hover:bg-[#fff2f2] rounded-lg border border-[#ff3b30]/5 transition-all"
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-[10px] font-bold text-[#ff3b30] uppercase tracking-tight line-clamp-1 flex-1">{t.name}</span>
                                                        <Badge className="bg-[#ff3b30] text-white text-[7px] font-black px-1 rounded ml-2">OVERDUE</Badge>
                                                    </div>
                                                </div>
                                            ))}
                                            {heatmapData.active.slice(0, 3).map(t => (
                                                <div 
                                                    key={t.id} 
                                                    onClick={() => handleTaskClick(t)}
                                                    className="group cursor-pointer p-2.5 bg-[#f5f5f7]/50 hover:bg-[#f5f5f7] rounded-lg border border-[#e5e5ea]/50 transition-all"
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-[10px] font-bold text-[#1d1d1f] uppercase tracking-tight line-clamp-1 flex-1">{t.name}</span>
                                                        <Badge className="bg-[#1d1d1f] text-white text-[7px] font-black px-1 rounded ml-2">{t.priority}</Badge>
                                                    </div>
                                                </div>
                                            ))}
                                            {(heatmapData.overdue.length > 3 || heatmapData.active.length > 3) && (
                                                <p className="text-[8px] font-bold text-center text-[#86868b] mt-2 tracking-widest uppercase opacity-40">+{heatmapData.overdue.length + heatmapData.active.length - 6} More critical</p>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeTab === 'planning' && (
                        <div className="space-y-8 h-[calc(100vh-140px)] overflow-y-auto pr-2 pb-10">
                            <WorkloadHeatmap data={workloadData || {}} />
                            
                            <div className="bg-white rounded-[32px] border border-[#e5e5ea] overflow-hidden flex-1 min-h-[600px] shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
                                <TimelineSchedule 
                                    tasks={tasks} 
                                    employees={projectId ? projectMembers : employees} 
                                    onTaskClick={handleTaskClick}
                                    onEmployeeClick={handleEmployeeActivityClick}
                                    refreshData={refreshData}
                                />
                            </div>

                            {/* Team Activity Feed */}
                            <div className="bg-white rounded-[32px] border border-[#e5e5ea] p-8 shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-xl font-black text-[#1d1d1f] tracking-tight">Team Activity Feed</h3>
                                        <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest mt-1">Real-time system updates</p>
                                    </div>
                                    <div className="p-3 rounded-2xl bg-[#f5f5f7] text-[#86868b] border border-[#e5e5ea]">
                                        <Clock size={20} strokeWidth={2.5} />
                                    </div>
                                </div>
                                
                                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    {auditLogs.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-20 bg-[#f5f5f7]/50 rounded-[24px] border-2 border-dashed border-[#eceef0]">
                                            <div className="text-4xl mb-4">📜</div>
                                            <p className="text-[11px] font-black text-[#86868b] uppercase tracking-widest">No activity recorded yet</p>
                                        </div>
                                    ) : (
                                        auditLogs
                                            .filter(log => !projectId || projectMembers.some(m => m.id === log.actor_id))
                                            .map((log) => (
                                            <div key={log.id} className="flex gap-4 p-4 rounded-2xl hover:bg-[#f5f5f7] transition-all border border-transparent hover:border-[#eceef0] group/log">
                                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 font-black text-[12px] text-[#1d1d1f] border border-[#eceef0] shadow-sm group-hover/log:border-[#0071e3] group-hover/log:text-[#0071e3] transition-colors">
                                                    {log.actor_name?.charAt(0) || 'S'}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-medium text-[#1d1d1f] leading-relaxed group-hover/log:text-black transition-colors">
                                                        {formatAuditEntry(log)}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <span className="text-[9px] font-black text-[#86868b] uppercase tracking-widest bg-[#f5f5f7] px-2 py-0.5 rounded-md border border-[#eceef0]">
                                                            {log.table_name}
                                                        </span>
                                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                                                            log.action === 'INSERT' ? 'bg-[#34c759]/10 text-[#34c759] border-[#34c759]/20' : 
                                                            log.action === 'UPDATE' ? 'bg-[#ff9500]/10 text-[#ff9500] border-[#ff9500]/20' : 
                                                            'bg-[#ff3b30]/10 text-[#ff3b30] border-[#ff3b30]/20'
                                                        }`}>
                                                            {log.action}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'team' && (
                        <div className="space-y-10">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-[#eceef0]">
                                <div>
                                    <h3 className="text-base font-black text-[#1d1d1f] tracking-tight">Communication Center</h3>
                                    <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-widest mt-0.5">Alert Broadcast System</p>
                                </div>
                                <Button onClick={() => setShowBroadcastModal(true)} className="w-full sm:w-auto rounded-lg h-9 px-6 bg-[#0071e3] text-white font-bold text-[10px] tracking-tight shadow-sm hover:bg-[#005bb7] transition-colors">📢 BROADCAST ALERT</Button>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="p-6 rounded-2xl border-[#eceef0]">
                                <h3 className="text-base font-black mb-4 text-[#1d1d1f] tracking-tight">Invite Member</h3>
                                <form onSubmit={handleInviteMember} className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Email Address</label>
                                        <input type="email" required value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="colleague@company.com" className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold outline-none focus:ring-1 ring-[#0071e3]" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Role</label>
                                        <select 
                                            value={inviteForm.role} 
                                            onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                                            className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0071e3]"
                                        >
                                            <option value="employee">Employee</option>
                                            <option value="manager">Manager</option>
                                        </select>
                                    </div>
                                    
                                    {inviteResult && (
                                        <p className={`text-[10px] font-bold px-4 ${inviteResult.type === 'error' ? 'text-[#ff3b30]' : 'text-[#34c759]'}`}>
                                            {inviteResult.text}
                                        </p>
                                    )}
                                    <button type="submit" className="w-full h-10 rounded-xl bg-[#0071e3] text-white font-black tracking-widest text-[10px] mt-2 shadow-sm hover:bg-[#005bb7] transition-colors">SEND INVITATION</button>
                                </form>
                            </Card>

                            <Card className="p-6 rounded-2xl border-[#eceef0]">
                                <h3 className="text-base font-black mb-4 text-[#1d1d1f] tracking-tight">
                                    {projectId ? 'Project Members' : 'Active Members'}
                                </h3>
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    {(projectId ? projectMembers : employees).filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())).map(emp => (
                                        <div key={emp.id} className="p-3 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] flex items-center justify-between group hover:border-[#0071e3] transition-colors min-w-0">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className="w-8 h-8 rounded-full bg-white border border-[#e5e5ea] flex items-center justify-center text-[10px] font-black shadow-sm group-hover:bg-[#0071e3] group-hover:text-white transition-all flex-shrink-0">
                                                    {emp.name.charAt(0)}
                                                </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="text-[11px] font-bold text-[#1d1d1f] truncate leading-tight">{emp.name}</p>
                                                            {emp.role === 'manager' && <Badge className="bg-[#0071e3] text-white border-none text-[7px] px-1.5 flex-shrink-0">ADM</Badge>}
                                                        </div>
                                                        <p className="text-[9px] font-medium text-[#86868b] truncate leading-none">{emp.email}</p>
                                                    </div>
                                            </div>
                                            <div className="flex gap-1.5 ml-3 flex-shrink-0 items-center">
                                                {empStatusMsg && empStatusMsg.id === emp.id && (
                                                    <span className="text-[8px] font-bold text-[#ff3b30] mr-1 animate-in fade-in slide-in-from-right-1">
                                                        {empStatusMsg.text}
                                                    </span>
                                                )}
                                                <button 
                                                    disabled={deletingEmpId === emp.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingEmpId(emp.id);
                                                        setEditEmpForm({ name: emp.name || '', role: (emp.role as any) || 'employee', password: '' });
                                                    }} 
                                                    className="w-7 h-7 rounded-lg border border-[#e5e5ea] bg-white flex items-center justify-center hover:bg-[#f5f5f7] transition-colors"
                                                >
                                                    <Pencil className="w-3 h-3 text-[#1d1d1f]" />
                                                </button>
                                                <button 
                                                    className="w-7 h-7 rounded-lg border border-[#e5e5ea] bg-white flex items-center justify-center hover:bg-[#ff3b30]/10 text-[#ff3b30] transition-colors"
                                                    onClick={(e) => handleDeleteEmployee(e, emp.id, emp.name)} 
                                                    disabled={deletingEmpId === emp.id}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                            </div>
                        </div>
                    )}

                    {activeTab === 'mine' && (
                        <div className="flex flex-col xl:flex-row gap-8 max-w-7xl mx-auto">
                            {/* Left: Log Activity */}
                            <div className="w-full xl:w-[400px]">
                                <Card className="p-8 rounded-[32px] border-[#eceef0] shadow-sm bg-white sticky top-8">
                                    <div className="flex items-center gap-3 mb-8">
                                        <div className="w-10 h-10 bg-[#0071e3] rounded-2xl flex items-center justify-center text-white text-xl shadow-lg ring-4 ring-[#0071e3]/10">🎯</div>
                                        <div>
                                            <h3 className="text-base font-black text-[#1d1d1f] tracking-tight">LOG NEW TASK</h3>
                                            <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-[0.2em] mt-0.5">Manager Activity</p>
                                        </div>
                                    </div>
                                    
                                    <form onSubmit={handleLogSubmit} className="space-y-6">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Task Name</label>
                                            <input 
                                                required 
                                                value={logForm.name} 
                                                onChange={e => setLogForm({ ...logForm, name: e.target.value })} 
                                                placeholder="What are you working on?" 
                                                className="w-full h-12 rounded-2xl bg-[#f5f5f7] border-none px-6 text-[11px] font-bold outline-none focus:ring-2 ring-[#0071e3]/20 transition-all placeholder:text-[#86868b]/50" 
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Project</label>
                                            <select 
                                                value={logForm.project_id} 
                                                onChange={e => setLogForm({ ...logForm, project_id: e.target.value })}
                                                className="w-full h-12 rounded-2xl bg-[#f5f5f7] border-none px-6 text-[11px] font-bold outline-none focus:ring-2 ring-[#0071e3]/20 transition-all appearance-none cursor-pointer"
                                            >
                                                <option value="">No Project (General)</option>
                                                {projects.map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Priority</label>
                                                <select 
                                                    value={logForm.priority} 
                                                    onChange={e => setLogForm({ ...logForm, priority: e.target.value as Priority })}
                                                    className="w-full h-12 rounded-2xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold appearance-none cursor-pointer focus:ring-2 ring-[#0071e3]/20 outline-none"
                                                >
                                                    <option value="Low">Low</option>
                                                    <option value="Medium">Medium</option>
                                                    <option value="High">High</option>
                                                    <option value="Urgent">Urgent</option>
                                                </select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Status</label>
                                                <select 
                                                    value={logForm.status} 
                                                    onChange={e => setLogForm({ ...logForm, status: e.target.value as Status })}
                                                    className="w-full h-12 rounded-2xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold appearance-none cursor-pointer focus:ring-2 ring-[#0071e3]/20 outline-none"
                                                >
                                                    <option value="To Do">To Do</option>
                                                    <option value="In Progress">In Progress</option>
                                                    <option value="In Review">In Review</option>
                                                    <option value="Blocked">Blocked</option>
                                                    <option value="Completed">Completed</option>
                                                </select>
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
                                                {tasks.filter(t => t.employee_id === userId && t.status !== 'Completed').length} ACTIVE
                                            </Badge>
                                        </div>
                                    </div>
                                    {renderPersonalTaskList(tasks.filter(t => (t.employee_id === userId || (t.assignee_ids && t.assignee_ids.includes(userId))) && t.status !== 'Completed'))}
                                </div>

                                {/* Completed Tasks */}
                                {tasks.some(t => t.employee_id === userId && t.status === 'Completed') && (
                                    <div className="pt-10 border-t border-[#eceef0]">
                                        <div className="flex items-center justify-between mb-6 px-4">
                                            <div className="flex items-center gap-3">
                                                <h3 className="text-sm font-black text-[#86868b] uppercase tracking-widest">Completion History</h3>
                                                <Badge className="bg-[#f5f5f7] text-[#86868b] border-none px-2.5 rounded-full font-bold text-[9px]">
                                                    {tasks.filter(t => t.employee_id === userId && t.status === 'Completed').length} DONE
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="opacity-75 grayscale-[0.2] hover:opacity-100 hover:grayscale-0 transition-all duration-500">
                                            {renderPersonalTaskList(tasks.filter(t => (t.employee_id === userId || (t.assignee_ids && t.assignee_ids.includes(userId))) && t.status === 'Completed'))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div className="flex items-center gap-6 mb-10 pb-8 border-b border-[#f0f0f2]">
                                <div className="w-16 h-16 bg-[#0071e3] rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-sm">
                                    {userName.charAt(0)}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-[#1d1d1f] tracking-tight">{userName}</h2>
                                    <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-widest leading-none mt-1">Workspace Admin</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-12">
                                <section>
                                    <h3 className="text-[10px] font-black text-[#86868b] uppercase tracking-[0.3em] mb-6">Task Digest</h3>
                                    <DigestSettings />
                                </section>
                                
                                <Card className="p-6 rounded-2xl border-[#eceef0]">
                                    <h3 className="text-[10px] font-black mb-6 text-[#1d1d1f] uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-lg bg-[#f5f5f7] flex items-center justify-center text-xs">👤</span>
                                        Profile Details
                                    </h3>
                                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Full Name</label>
                                            <input value={profileName} onChange={e => setProfileName(e.target.value)} className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold outline-none focus:ring-1 ring-[#0071e3]" />
                                        </div>
                                        <button type="submit" disabled={isUpdatingProfile} className="w-full h-10 rounded-xl bg-[#1d1d1f] text-white font-black tracking-widest text-[10px] mt-2">
                                            {isUpdatingProfile ? 'UPDATING...' : 'SAVE CHANGES'}
                                        </button>
                                    </form>
                                </Card>

                                <Card className="p-6 rounded-2xl border-[#eceef0]">
                                    <h3 className="text-[10px] font-black mb-6 text-[#1d1d1f] uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-6 h-6 rounded-lg bg-[#f5f5f7] flex items-center justify-center text-xs">🔒</span>
                                        Security
                                    </h3>
                                    <form onSubmit={handleChangePassword} className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">New Password</label>
                                                <input type="password" value={passwords.new} onChange={e => setPasswords({ ...passwords, new: e.target.value })} className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold outline-none focus:ring-1 ring-[#0071e3]" placeholder="••••••••" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Confirm</label>
                                                <input type="password" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold outline-none focus:ring-1 ring-[#0071e3]" placeholder="••••••••" />
                                            </div>
                                        </div>
                                        <button type="submit" disabled={isUpdatingPassword} className="w-full h-10 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] font-black tracking-widest text-[10px] border border-[#e5e5ea] hover:bg-[#e5e5ea] transition-colors mt-2">
                                            {isUpdatingPassword ? 'UPDATING...' : 'CHANGE PASSWORD'}
                                        </button>
                                    </form>
                                </Card>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* --- EDIT EMPLOYEE MODAL --- */}
            {editingEmpId && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
                    <Card className="w-full max-w-xl p-10 rounded-[48px] bg-white shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-10">
                            <h2 className="text-3xl font-black text-[#1d1d1f] tracking-tight">Edit Member</h2>
                            <button onClick={() => {
                                setEditingEmpId(null);
                                setEditEmpForm({ name: '', role: 'employee', password: '' });
                            }} className="w-10 h-10 rounded-full bg-[#f5f5f7] flex items-center justify-center font-bold hover:bg-[#e5e5ea]">✕</button>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(editingEmpId); }} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Full Name</label>
                                <Input required value={editEmpForm.name} onChange={e => setEditEmpForm({ ...editEmpForm, name: e.target.value })} className="h-14 rounded-[20px] bg-[#f5f5f7] border-none px-6 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Role</label>
                                <Select value={editEmpForm.role} onChange={e => setEditEmpForm({ ...editEmpForm, role: e.target.value as any })} className="h-14 rounded-[20px] bg-[#f5f5f7] border-none px-6 font-bold">
                                    <option value="employee">Employee</option>
                                    <option value="manager">Manager</option>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">New Password (leave blank to keep current)</label>
                                <Input type="password" value={editEmpForm.password} onChange={e => setEditEmpForm({ ...editEmpForm, password: e.target.value })} placeholder="••••••••" className="h-14 rounded-[20px] bg-[#f5f5f7] border-none px-6 font-bold" />
                            </div>
                            <Button type="submit" className="w-full h-16 rounded-[28px] font-black tracking-widest shadow-2xl shadow-[#0071e3]/30 mt-4">SAVE CHANGES</Button>
                        </form>
                    </Card>
                </div>
            )}

            {/* --- ASSIGN TASK MODAL --- */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <Card className="w-full max-w-xl p-10 rounded-[48px] bg-white shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-10">
                            <h2 className="text-3xl font-black text-[#1d1d1f] tracking-tight">Create New Task</h2>
                            <button onClick={() => {
                                setShowAssignModal(false);
                                setAssignError(null);
                            }} className="w-10 h-10 rounded-full bg-[#f5f5f7] flex items-center justify-center font-bold hover:bg-[#e5e5ea]">✕</button>
                        </div>

                        <form onSubmit={handleAssignTask} className="space-y-8">
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Project</label>
                                        <Select 
                                            value={assignForm.project_id} 
                                            onChange={e => setAssignForm({ ...assignForm, project_id: e.target.value })}
                                            className="h-14 rounded-[20px] bg-[#f5f5f7] border-none px-6 font-bold"
                                        >
                                            <option value="">No Project (General)</option>
                                            {projects.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Owner</label>
                                        <Select required value={assignForm.employee_id} onChange={e => setAssignForm({ ...assignForm, employee_id: e.target.value })} className="h-14 rounded-[20px] bg-[#f5f5f7] border-none px-6 font-bold">
                                            <option value="">Select owner</option>
                                            {(projectId ? projectMembers : employees).map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                                            ))}
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Additional Collaborators</label>
                                        <div className="flex flex-wrap gap-2 p-4 bg-[#f5f5f7] rounded-[24px]">
                                            {(projectId ? projectMembers : employees).filter(e => e.id !== assignForm.employee_id).map(emp => {
                                                const isSelected = assignForm.assignee_ids?.includes(emp.id);
                                                return (
                                                    <button
                                                        key={emp.id}
                                                        type="button"
                                                        onClick={() => {
                                                            const current = assignForm.assignee_ids || [];
                                                            const next = isSelected 
                                                                ? current.filter(id => id !== emp.id)
                                                                : [...current, emp.id];
                                                            setAssignForm({ ...assignForm, assignee_ids: next });
                                                        }}
                                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${isSelected ? 'bg-[#0071e3] text-white shadow-md' : 'bg-white text-[#86868b] hover:bg-[#e5e5ea]'}`}
                                                    >
                                                        {emp.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Task Objective</label>
                                    <Input required value={assignForm.name} onChange={e => {
                                        setAssignForm({ ...assignForm, name: e.target.value });
                                        if (assignError) setAssignError(null);
                                    }} placeholder="What needs to be done?" className={`h-14 rounded-[20px] bg-[#f5f5f7] border-none px-6 font-bold ${assignError ? 'ring-2 ring-red-500' : ''}`} />
                                    {assignError && (
                                        <p className="mt-2 text-[10px] font-black text-red-500 uppercase tracking-widest ml-4 animate-in fade-in slide-in-from-top-2">
                                            {assignError}
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Deadline</label>
                                        <Input type="date" required value={assignForm.deadline} onChange={e => setAssignForm({ ...assignForm, deadline: e.target.value })} className="h-14 rounded-[20px] bg-[#f5f5f7] border-none px-6 font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Priority</label>
                                        <Select value={assignForm.priority} onChange={e => setAssignForm({ ...assignForm, priority: e.target.value as any })} className="h-14 rounded-[20px] bg-[#f5f5f7] border-none px-6 font-bold">
                                            <option>Low</option>
                                            <option>Medium</option>
                                            <option>High</option>
                                            <option>Urgent</option>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <Button type="submit" className="w-full h-16 rounded-[28px] font-black tracking-widest shadow-2xl shadow-[#0071e3]/30 mt-4">DISPATCH TASK</Button>
                        </form>
                    </Card>
                </div>
            )}

            {/* --- TASK DETAILS MODAL --- */}
            {selectedTask && (
                <TaskDetailsModal 
                    task={selectedTask.task}
                    subtasks={selectedTask.subtasks}
                    onClose={() => setSelectedTask(null)}
                    onUpdateStatus={handleUpdateStatusFromModal}
                    onDeleteTask={handleDeleteTask}
                    isEditable={true}
                    currentUserId={userId}
                    isManager={true}
                    refreshData={refreshData}
                    employees={employees}
                />
            )}

            {/* --- BROADCAST ALERT MODAL --- */}
            {showBroadcastModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
                    <Card className="w-full max-w-xl p-10 rounded-[48px] bg-white shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-10">
                            <h2 className="text-3xl font-black text-[#1d1d1f] tracking-tight">Broadcast Alert</h2>
                            <button onClick={() => setShowBroadcastModal(false)} className="w-10 h-10 rounded-full bg-[#f5f5f7] flex items-center justify-center font-bold hover:bg-[#e5e5ea]">✕</button>
                        </div>

                        <form onSubmit={handleBroadcastAlert} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Alert Type</label>
                                <Select value={broadcastForm.type} onChange={e => setBroadcastForm({ ...broadcastForm, type: e.target.value as any })} className="h-14 rounded-[20px] bg-[#f5f5f7] border-none px-6 font-bold">
                                    <option value="system">Standard System Notification</option>
                                    <option value="urgent">Urgent Priority Alert</option>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Message</label>
                                <textarea 
                                    required 
                                    value={broadcastForm.message} 
                                    onChange={e => setBroadcastForm({ ...broadcastForm, message: e.target.value })} 
                                    placeholder="Type your message to all employees..."
                                    className="w-full h-40 rounded-3xl bg-[#f5f5f7] border-none p-6 text-sm font-bold resize-none outline-none ring-2 ring-transparent focus:ring-[#0071e3]/20"
                                />
                            </div>
                            <Button type="submit" disabled={isBroadcasting} className="w-full h-16 rounded-[28px] font-black tracking-widest shadow-2xl shadow-[#ff9500]/30 mt-4 bg-[#ff9500] hover:bg-[#ff8c00]">
                                {isBroadcasting ? 'SENDING BROADCAST...' : 'SEND TO ALL EMPLOYEES'}
                            </Button>
                        </form>
                    </Card>
                </div>
            )}
            {showTaskDeleteConfirm && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
                        onClick={cancelDeleteTask}
                    />
                    <Card className="relative w-full max-w-[360px] p-8 shadow-[0_32px_64px_rgba(0,0,0,0.3)] border-none bg-white rounded-3xl animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-14 h-14 bg-[#ff3b30]/10 rounded-2xl flex items-center justify-center mb-6">
                                <Trash2 size={24} color="#ff3b30" strokeWidth={2.5} />
                            </div>
                            
                            <h3 className="text-lg font-black text-[#1d1d1f] tracking-tight mb-2 uppercase tracking-widest text-[11px]">Confirm Deletion</h3>
                            <p className="text-[13px] text-[#86868b] font-medium leading-relaxed mb-8">
                                Permanently delete <span className="text-[#1d1d1f] font-black underline decoration-[#ff3b30]/30">"{taskToDelete?.name}"</span>?
                            </p>

                            <div className="grid grid-cols-2 gap-3 w-full">
                                <Button 
                                    variant="secondary" 
                                    className="h-11 rounded-xl font-black text-[10px] uppercase tracking-widest border-[#d2d2d7] hover:bg-[#f5f5f7] text-[#86868b]"
                                    onClick={cancelDeleteTask}
                                    disabled={isDeletingTask}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    className="h-11 rounded-xl font-black text-[10px] uppercase tracking-widest bg-[#ff3b30] hover:bg-[#e03126] text-white border-none shadow-lg shadow-[#ff3b30]/20"
                                    onClick={confirmDeleteTask}
                                    disabled={isDeletingTask}
                                >
                                    {isDeletingTask ? 'Deleting...' : 'Delete Task'}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}
            
            {showEmployeeDeleteConfirm && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
                        onClick={cancelDeleteEmployee}
                    />
                    <Card className="relative w-full max-w-[360px] p-8 shadow-[0_32px_64px_rgba(0,0,0,0.3)] border-none bg-white rounded-3xl animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-14 h-14 bg-[#ff3b30]/10 rounded-2xl flex items-center justify-center mb-6">
                                <Trash2 size={24} color="#ff3b30" strokeWidth={2.5} />
                            </div>
                            
                            <h3 className="text-lg font-black text-[#1d1d1f] tracking-tight mb-2 uppercase tracking-widest text-[11px]">Remove Member</h3>
                            <p className="text-[13px] text-[#86868b] font-medium leading-relaxed mb-8">
                                Permanently remove <span className="text-[#1d1d1f] font-black underline decoration-[#ff3b30]/30">"{employeeToDelete?.name}"</span>?
                            </p>

                            <div className="grid grid-cols-2 gap-3 w-full">
                                <Button 
                                    variant="secondary" 
                                    className="h-11 rounded-xl font-black text-[10px] uppercase tracking-widest border-[#d2d2d7] hover:bg-[#f5f5f7] text-[#86868b]"
                                    onClick={cancelDeleteEmployee}
                                    disabled={deletingEmpId !== null}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    className="h-11 rounded-xl font-black text-[10px] uppercase tracking-widest bg-[#ff3b30] hover:bg-[#e03126] text-white border-none shadow-lg shadow-[#ff3b30]/20"
                                    onClick={confirmDeleteEmployee}
                                    disabled={deletingEmpId !== null}
                                >
                                    {deletingEmpId !== null ? 'Removing...' : 'Remove Member'}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e5e5ea;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #d2d2d7;
                }
            `}</style>

            {/* Global Floating Timer Bar */}
            {Object.keys(activeTimers).length > 0 && (
                <div className="fixed bottom-8 right-8 z-[100] animate-in slide-in-from-bottom-8 duration-500">
                    <div className="bg-[#1d1d1f] text-white px-6 py-4 rounded-[28px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center gap-6 border border-white/10 backdrop-blur-xl group/timer">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="w-3 h-3 bg-[#ff3b30] rounded-full animate-ping absolute inset-0"></div>
                                <div className="w-3 h-3 bg-[#ff3b30] rounded-full relative"></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#86868b] leading-none mb-1">Active Timer</span>
                                <span className="text-xl font-black tabular-nums tracking-tight">
                                    {formatElapsed(Object.values(activeTimers)[0])}
                                </span>
                            </div>
                        </div>
                        <div className="h-10 w-[1px] bg-white/10"></div>
                        <button 
                            onClick={() => {
                                const [subtaskId, startTime] = Object.entries(activeTimers)[0];
                                const taskId = subtaskId.startsWith('new-') 
                                    ? subtaskId.replace('new-', '') 
                                    : Object.keys(subtasksMap).find(tId => subtasksMap[tId].some(s => s.id === subtaskId));
                                if (taskId) handleStopTimer(subtaskId, taskId);
                            }}
                            className="px-5 py-2.5 bg-white text-[#1d1d1f] rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-[#ff3b30] hover:text-white transition-all shadow-lg active:scale-95"
                        >
                            STOP TIMER
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Helper Components ---

function NavItem({ icon, label, active = false, onClick }: { icon: string, label: string, active?: boolean, onClick?: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={`w-full flex items-center gap-4 px-5 py-4 rounded-[28px] transition-all duration-400 group relative ${active ? 'bg-[#0071e3] shadow-xl shadow-[#0071e3]/25 text-white' : 'hover:bg-[#f5f5f7] text-[#86868b]'}`}
        >
            <span className={`text-xl transition-transform duration-300 ${active ? 'scale-110' : 'filter grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110'}`}>{icon}</span>
            <span className={`text-[10px] font-black tracking-[0.2em] transition-colors ${active ? 'text-white' : 'group-hover:text-[#1d1d1f]'}`}>{label}</span>
            {active && <div className="absolute right-4 w-1.5 h-1.5 rounded-full bg-white/50 animate-pulse" />}
        </button>
    );
}

const formatTaskDate = (dateStr: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);

    if (taskDate.getTime() === today.getTime()) return { label: 'TODAY', color: 'bg-white/40 text-inherit' };
    if (taskDate.getTime() === tomorrow.getTime()) return { label: 'TOMORROW', color: 'bg-white/40 text-inherit' };

    return { 
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(), 
        color: 'bg-white/40 text-inherit' 
    };
};

function BoardColumn({ title, tasks, subtasksMap, commentCounts, attachmentCounts, employees, onTaskClick, onDeleteTask }: { title: string, tasks: Task[], subtasksMap: Record<string, Subtask[]>, commentCounts: Record<string, number>, attachmentCounts: Record<string, number>, employees: Profile[], onTaskClick: (task: Task) => void, onDeleteTask: (taskId: string, taskName: string) => void }) {
    return (
        <div className="flex flex-col h-full min-w-[320px] max-w-[320px] flex-shrink-0">
            <div className="flex items-center justify-between px-2 mb-6">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                        title.toUpperCase().includes('TO DO') ? 'bg-[#0071e3]' : 
                        title.toUpperCase().includes('IN PROGRESS') ? 'bg-[#ff9500]' : 
                        title.toUpperCase().includes('BLOCKED') ? 'bg-[#ff3b30]' : 'bg-[#34c759]'
                    }`} />
                    <h3 className="text-[11px] font-black text-[#1d1d1f] tracking-widest uppercase">{title}</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#f5f5f7] text-[10px] font-black text-[#86868b] tabular-nums">{tasks.length}</span>
            </div>
            
            <div className="space-y-4 flex-1 pb-4 custom-scrollbar overflow-y-auto pr-2">
                {tasks.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-[#e5e5ea] rounded-[32px] flex items-center justify-center bg-[#f5f5f7]/50 transition-colors hover:bg-[#f5f5f7]">
                        <span className="text-[10px] font-black text-[#d2d2d7] uppercase tracking-[0.2em]">Empty</span>
                    </div>
                ) : (
                    tasks.map(task => {
                        const dateInfo = formatTaskDate(task.deadline || task.start_date);
                        
                        // Time-Based Progress Calculation
                        const now = new Date();
                        const startDate = new Date(task.start_date);
                        const deadlineDate = new Date(task.deadline);
                        const totalDuration = deadlineDate.getTime() - startDate.getTime();
                        const elapsedDuration = now.getTime() - startDate.getTime();
                        
                        let progress = 0;
                        let isOverdue = false;

                        if (task.status === 'Completed') {
                            progress = 100;
                        } else {
                            if (totalDuration > 0) {
                                progress = Math.min(100, Math.max(0, Math.round((elapsedDuration / totalDuration) * 100)));
                            } else {
                                progress = now >= startDate ? 100 : 0;
                            }
                            
                            // Identify Overdue
                            if (now > deadlineDate) {
                                isOverdue = true;
                            }
                        }

                        // User-Specific Card Colors
                        const userColors = [
                            'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]', // Soft Red
                            'bg-[#ffedd5] text-[#9a3412] border-[#fed7aa]', // Soft Orange
                            'bg-[#ecfdf5] text-[#065f46] border-[#d1fae5]', // Soft Emerald
                            'bg-[#e0f2fe] text-[#075985] border-[#bae6fd]', // Soft Blue
                            'bg-[#f5f3ff] text-[#5b21b6] border-[#ddd6fe]', // Soft Purple
                            'bg-[#fdf2f8] text-[#9d174d] border-[#fbcfe8]', // Soft Pink
                            'bg-[#eef2ff] text-[#3730a3] border-[#e0e7ff]', // Soft Indigo
                            'bg-[#f0fdfa] text-[#115e59] border-[#ccfbf1]'  // Soft Teal
                        ];

                        // Simple hash function for consistent color mapping
                        const userHash = (task.employee_id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                        const colorClass = userColors[userHash % userColors.length];

                        return (
                            <div 
                                key={task.id} 
                                onClick={() => onTaskClick(task)}
                                className={`${colorClass} p-6 rounded-[32px] border shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-500 group cursor-pointer relative flex flex-col min-h-[180px]`}
                            >
                                {/* Header Tags */}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    <div className={`px-2.5 py-1 rounded-full text-[8px] font-black tracking-widest uppercase bg-white/50 backdrop-blur-sm border border-black/5`}>
                                        #{task.priority.toLowerCase()}
                                    </div>
                                    {dateInfo && (
                                        <div className={`px-2.5 py-1 rounded-full text-[8px] font-black tracking-widest uppercase ${dateInfo.color} backdrop-blur-sm border border-black/5`}>
                                            {dateInfo.label}
                                        </div>
                                    )}
                                </div>

                                {/* Title */}
                                <h4 className="text-[13px] font-extrabold leading-[1.4] mb-4 text-inherit opacity-90 group-hover:opacity-100 transition-opacity">
                                    {task.name || 'Untitled Task'}
                                </h4>

                                {/* Progress Indicator */}
                                <div className="mt-auto space-y-3">
                                    <div className="flex items-center gap-1.5">
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                                            <div 
                                                key={i} 
                                                className={`h-1.5 w-1.5 rounded-full transition-all duration-500 ${i <= Math.round((progress / 100) * 12) ? 'bg-current opacity-60 scale-110' : 'bg-current opacity-10'}`} 
                                            />
                                        ))}
                                        {isOverdue ? (
                                            <span className="text-[9px] font-black ml-1 text-[#ff3b30] animate-pulse uppercase tracking-widest">OVERDUE</span>
                                        ) : (
                                            <span className="text-[9px] font-black ml-1 opacity-60 tabular-nums">{progress}%</span>
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between pt-4 border-t border-black/5">
                                        <div className="flex -space-x-2">
                                            {Array.from(new Set([task.employee_id, ...(task.assignee_ids || [])])).slice(0, 4).map((id, idx) => {
                                                const emp = employees.find(e => e.id === id);
                                                if (!emp) return null;
                                                return (
                                                    <div 
                                                        key={`${task.id}-avatar-${id}-${idx}`} 
                                                        className="w-7 h-7 rounded-full bg-white border-2 border-current flex items-center justify-center text-[10px] font-black shadow-sm ring-1 ring-black/5"
                                                        title={emp.name}
                                                    >
                                                        {emp.name?.charAt(0) || '?'}
                                                    </div>
                                                );
                                            })}
                                            {Array.from(new Set([task.employee_id, ...(task.assignee_ids || [])])).length > 4 && (
                                                <div className="w-7 h-7 rounded-full bg-white/80 border-2 border-current flex items-center justify-center text-[9px] font-black opacity-60 backdrop-blur-sm">
                                                    +{Array.from(new Set([task.employee_id, ...(task.assignee_ids || [])])).length - 4}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                                                className="flex items-center gap-1 text-[9px] font-black opacity-40 hover:opacity-100 transition-opacity"
                                            >
                                                <span className="text-xs transition-transform group-hover:scale-110">💬</span> {commentCounts[task.id] || 0}
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); onTaskClick(task); }}
                                                className="flex items-center gap-1 text-[9px] font-black opacity-40 hover:opacity-100 transition-opacity"
                                            >
                                                <span className="text-xs transition-transform group-hover:scale-110">📎</span> {attachmentCounts[task.id] || 0}
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteTask(task.id, task.name);
                                                }}
                                                className="p-1.5 hover:bg-white/50 rounded-xl transition-all opacity-0 group-hover:opacity-100 text-inherit"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
