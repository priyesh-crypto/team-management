"use client";
import dynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { TaskDetailsModal } from '@/components/ui/TaskDetailsModal';
import { TaskDetailsView } from '@/components/ui/TaskDetailsView';
import { toast } from 'sonner';

const TimelineSchedule = dynamic(() => import('@/components/ui/TimelineSchedule'), { 
    ssr: false,
    loading: () => <div className="h-96 w-full animate-pulse bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-slate-400">Loading Timeline...</div>
});
import { Task, Subtask, Profile, Priority, Status, Project, getTasks, getProjects, getProfiles, saveTask, updateTaskPriority, updateTaskStatus, deleteTask, updateTask, getSubtasks, getBulkSubtasks, saveSubtask, updateSubtaskStatus, updateSubtaskHours, deleteSubtask, updateSubtask, updateProfile, changePassword, updateOwnPassword, logout, getNotifications, markNotificationAsRead, markAllNotificationsAsRead, clearNotifications, Notification, ActivityLog, getOrgActivityFeed, getBulkCounts, syncOverdueTasks, getDashboardData } from '@/app/actions/actions';
import { createClient } from '@/utils/supabase/client';
import { Card, Button, Input, Select, Badge } from '@/components/ui/components';
import { ProjectSwitcher } from '@/components/ProjectSwitcher';
import { EmployeeSidebar } from './layout/EmployeeSidebar';
import { EmployeeHeader } from './layout/EmployeeHeader';
import { EmployeeBoardView } from './dashboard/EmployeeBoardView';
import { EmployeeRightPanel } from './dashboard/EmployeeRightPanel';
import { SettingsView } from './dashboard/SettingsView';
import { Menu, X, Clock, Trash2, Pencil, Search, Bell, CheckCircle2, AlertCircle, ChevronRight, Activity, Zap, Plus, MessageSquare, Paperclip, LogOut } from 'lucide-react';
import { formatAuditEntry } from '@/utils/audit-formatters';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';


export default function EmployeeDashboard({
    userId,
    userName,
    userAvatarUrl,
    projectId,
    userRole,
    orgId,
    initialData
}: {
    userId: string,
    userName: string,
    userAvatarUrl?: string | null,
    projectId?: string,
    userRole: 'employee' | 'manager',
    orgId: string,
    initialData?: any
}) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'mine' | 'team' | 'schedule' | 'settings'>('mine');
    const [viewMode, setViewMode] = useState<'today' | 'overview'>('today');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTask, setSelectedTask] = useState<{ task: Task, subtasks: Subtask[] } | null>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const mainRef = React.useRef<HTMLDivElement>(null);

    // Scroll main content to top when switching tabs
    React.useEffect(() => {
        mainRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }, [activeTab]);

    // Data
    const [allTasks, setAllTasks] = useState<Task[]>(initialData?.tasks || []);
    const [myTasks, setMyTasks] = useState<Task[]>(() => {
        if (!initialData?.tasks) return [];
        return initialData.tasks.filter((t: Task) => t.employee_id === userId || (t.assignee_ids && t.assignee_ids.includes(userId)));
    });
    const [employees, setEmployees] = useState<Profile[]>(initialData?.profiles || []);
    const [projects, setProjects] = useState<Project[]>(initialData?.projects || []);
    const [loading, setLoading] = useState(!initialData);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        project_id: projectId || '',
        start_date: new Date().toISOString().split('T')[0],
        deadline: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        priority: 'Medium' as Priority,
        hours_spent: 0,
        status: 'To Do' as Status,
        notes: '',
        start_time: '09:00',
        end_time: '17:00',
        assignee_ids: [] as string[]
    });

    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editTaskData, setEditTaskData] = useState<Partial<Task>>({});
    const [subtasksMap, setSubtasksMap] = useState<Record<string, Subtask[]>>(() => {
        const map: Record<string, Subtask[]> = {};
        if (initialData?.subtasks) {
            initialData.subtasks.forEach((st: Subtask) => {
                if (!map[st.task_id]) map[st.task_id] = [];
                map[st.task_id].push(st);
            });
        }
        return map;
    });
    const [commentCounts, setCommentCounts] = useState<Record<string, number>>(initialData?.counts?.comments || {});
    const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>(initialData?.counts?.attachments || {});
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    const activeTask = useMemo(() => {
        if (!selectedTaskId) return myTasks[0] || null;
        return myTasks.find(t => t.id === selectedTaskId) || myTasks[0] || null;
    }, [selectedTaskId, myTasks]);

    useEffect(() => {
        if (myTasks.length > 0 && !selectedTaskId) {
            setSelectedTaskId(myTasks[0].id);
        }
    }, [myTasks]);
    const [isDeletingTask, setIsDeletingTask] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<{ id: string, name: string } | null>(null);
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
    const [notifications, setNotifications] = useState<Notification[]>(initialData?.notifications || []);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState((initialData?.notifications || []).filter((n: any) => !n.is_read).length);
    const [subtaskToDelete, setSubtaskToDelete] = useState<{ taskId: string, subtaskId: string, subtaskName: string } | null>(null);
    const [isDeletingSubtask, setIsDeletingSubtask] = useState(false);
    const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(initialData?.logs || []);

    const [isSideSheetOpen, setIsSideSheetOpen] = useState(false);
    const [taskForSheet, setTaskForSheet] = useState<Task | null>(null);
    const [sheetSubtasks, setSheetSubtasks] = useState<Subtask[]>([]);
    const [isSheetLoading, setIsSheetLoading] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [timelineSearchFilter, setTimelineSearchFilter] = useState<string>('');
    const [activeTimers, setActiveTimers] = useState<Record<string, string>>({}); // subtaskId -> ISO startTime

    const handleEmployeeClick = (employee: Profile) => {
        setTimelineSearchFilter(employee.name);
        setActiveTab('schedule');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const [now, setNow] = useState(new Date());
    const notificationRef = useRef<HTMLDivElement>(null);

    // Optimized refresh with debounce
    const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const refreshDataRef = useRef<(silent?: boolean) => Promise<{ tasks: Task[], profiles: Profile[] }>>(null! as any);

    const refreshData = useCallback(async (silent = true) => {
        if (!silent) setLoading(true);
        try {
            // Automatically sync overdue tasks in the database - do this in background
            syncOverdueTasks().catch(err => console.error("Sync error:", err));

            // Use consolidated fetch for better performance
            const data = await getDashboardData(projectId);
            if (!data) return { tasks: [], profiles: [] };
            
            setActivityLogs(data.logs);
            setProjects(data.projects);
            setAllTasks(data.tasks);
            const myTasksFiltered = data.tasks.filter((t: Task) => t.employee_id === userId || (t.assignee_ids && t.assignee_ids.includes(userId)));
            setMyTasks(myTasksFiltered);
            setEmployees(data.profiles);
            
            // Notifications are separate but important
            const notifs = await getNotifications(userId || '');
            setNotifications(notifs || []);
            setUnreadCount((notifs || []).filter((n: Notification) => !n.is_read).length);

            // Level 2: Secondary Data (Subtasks, Counts)
            const allSubtasks = data.subtasks;
            const counts = data.counts;
            
            // Sync task sheet if it's open
            setTaskForSheet(prev => {
                if (prev) {
                    const updated = data.tasks.find((t: Task) => t.id === prev.id);
                    if (updated) {
                        setSheetSubtasks(allSubtasks.filter((st: Subtask) => st.task_id === updated.id));
                        return updated;
                    }
                }
                return prev;
            });

            const newSubtasksMap: Record<string, Subtask[]> = {};
            allSubtasks.forEach((st: Subtask) => {
                if (!newSubtasksMap[st.task_id]) newSubtasksMap[st.task_id] = [];
                newSubtasksMap[st.task_id].push(st);
            });
            setSubtasksMap(newSubtasksMap);
            setCommentCounts(counts.comments);
            setAttachmentCounts(counts.attachments);
            return { tasks: data.tasks, profiles: data.profiles };
        } catch (error: any) {
            console.error("Error refreshing dashboard:", error);
            return { tasks: [], profiles: [] };
        } finally {
            setLoading(false);
        }
    }, [projectId, userId]);

    // Update ref for debounced access
    useEffect(() => {
        refreshDataRef.current = refreshData;
    }, [refreshData]);

    const debouncedRefresh = useCallback((silent = true) => {
        if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = setTimeout(() => {
            if (refreshDataRef.current) refreshDataRef.current(silent);
        }, 500);
    }, []);

    useEffect(() => {
        const supabase = createClient();
        const taskChannel = supabase
            .channel('employee-dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => debouncedRefresh(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, () => debouncedRefresh(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => debouncedRefresh(true))
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, () => debouncedRefresh(true))
            .subscribe();

        return () => {
            supabase.removeChannel(taskChannel);
        };
    }, [debouncedRefresh]);

    // Initial Load
    useEffect(() => {
        if (userId) {
            // Only fetch if we don't have initial data or on subsequent mounts
            if (!initialData) {
                refreshData(false);
            } else {
                setLoading(false);
            }
        }
    }, [userId, projectId, refreshData, initialData]);

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
        if (loading) {
            const timer = setTimeout(() => {
                setLoading(false);
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [loading]);

    useEffect(() => {
        localStorage.setItem('activeTimers', JSON.stringify(activeTimers));
    }, [activeTimers]);

    useEffect(() => {
        // Reduced frequency to once per minute - enough for "now" precision on dates
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);


    const openTaskSheet = (task: Task) => {
        setTaskForSheet(task);
        setSheetSubtasks(subtasksMap[task.id] || []);
        setIsSideSheetOpen(true);
    };

    const closeTaskSheet = () => {
        setIsSideSheetOpen(false);
        setTaskForSheet(null);
        setSheetSubtasks([]);
    };

    const handleUpdateStatusFromModal = async (taskId: string, status: Status) => {
        setIsUpdatingStatus(true);
        try {
            await updateTaskStatus(taskId, status);
            await refreshData();
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleUpdatePriorityFromModal = async (taskId: string, priority: Priority) => {
        setIsUpdatingStatus(true);
        try {
            await updateTaskPriority(taskId, priority);
            await refreshData();
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        const tempId = `temp-${Date.now()}`;
        const newTaskData = {
            ...formData,
            employee_id: userId,
            hours_spent: Number(formData.hours_spent)
        };

        // 1. Optimistic Update
        const optimisticTask: Task = {
            id: tempId,
            ...newTaskData,
            org_id: orgId || '',
            workspace_id: '', // Will be filled by server
            created_at: new Date().toISOString(),
            project_id: (newTaskData.project_id && newTaskData.project_id !== "") ? newTaskData.project_id : undefined,
            employee_id: (newTaskData.employee_id && newTaskData.employee_id !== "") ? newTaskData.employee_id : userId || '',
        };

        const originalMyTasks = [...myTasks];
        const originalAllTasks = [...allTasks];
        
        setMyTasks(prev => [optimisticTask, ...prev]);
        setAllTasks(prev => [optimisticTask, ...prev]);

        // Reset form immediately
        setFormData(prev => ({
            ...prev,
            name: '',
            project_id: projectId || '',
            hours_spent: 0,
            notes: '',
            assignee_ids: []
        }));

        try {
            const result = await saveTask(newTaskData);
            if (result.success) {
                // Successful save, silent refresh will replace temp task with real one
                await refreshData(true);
            } else {
                // Rollback
                setMyTasks(originalMyTasks);
                setAllTasks(originalAllTasks);
                setError(result.error || 'Failed to save task.');
            }
        } catch (err: any) {
            setMyTasks(originalMyTasks);
            setAllTasks(originalAllTasks);
            setError(err.message || 'An unexpected error occurred.');
        }
    };

    const handleUpdateTask = async (taskId: string) => {
        try {
            await updateTask(taskId, editTaskData);
            setEditingTaskId(null);
            refreshData(true);
        } catch (err: any) {
            toast.error(err.message || "Failed to update task.");
        }
    };

    const handleAddSubtaskDirect = async (taskId: string, name: string, hours: number, date: string, startTime: string, endTime: string) => {
        if (taskId.startsWith('temp-')) {
            toast.error("Please wait for the task to finish saving before adding a work log.");
            return;
        }

        // Optimistic State Update
        const tempId = `temp-sub-${Date.now()}`;
        const newSubtask: Subtask = {
            id: tempId,
            task_id: taskId,
            employee_id: userId,
            name: name.trim(),
            hours_spent: hours,
            is_completed: true,
            start_time: startTime,
            end_time: endTime,
            date_logged: date,
            created_at: new Date().toISOString(),
            org_id: orgId
        };

        // 1. Update the subtasks list for the detail modal
        if (taskForSheet && taskForSheet.id === taskId) {
            setSheetSubtasks(prev => [newSubtask, ...prev]);
            setTaskForSheet(prev => prev ? { ...prev, hours_spent: (prev.hours_spent || 0) + hours } : null);
        }

        // 2. Update task hours in the dashboard lists
        const updateTaskHours = (taskList: Task[]) => 
            taskList.map(t => t.id === taskId ? { ...t, hours_spent: (t.hours_spent || 0) + hours } : t);
        
        setMyTasks(prev => updateTaskHours(prev));
        setAllTasks(prev => updateTaskHours(prev));

        try {
            await saveSubtask({ 
                task_id: taskId, 
                employee_id: userId,
                name: name.trim(), 
                hours_spent: hours,
                is_completed: true,
                start_time: startTime,
                end_time: endTime,
                date_logged: date
            });
            
            // Silence refresh in background to sync with server
            refreshData(true);
        } catch (err: any) {
            console.error("Failed to save subtask:", err);
            // Revert optimistic update on failure (optional, but safer)
            refreshData(true); 
            toast.error("Failed to add work log. Your view will be refreshed.");
            throw err;
        }
    };

    const handleStartTimer = (subtaskId: string, taskId: string) => {
        setActiveTimers(prev => ({ ...prev, [subtaskId]: new Date().toISOString() }));
    };

    const handleStopTimer = (subtaskId: string, taskId: string) => {
        const startTimeIso = activeTimers[subtaskId];
        if (!startTimeIso) return;
        
        // Remove from active timers
        setActiveTimers(prev => {
            const next = { ...prev };
            delete next[subtaskId];
            return next;
        });
        
        return startTimeIso; // Caller might want the startTime
    };

    const handleDeleteSubtaskDirect = async (taskId: string, subtaskId: string, subtaskName: string) => {
        try {
            await deleteSubtask(subtaskId, taskId);
            await refreshData();
        } catch (err: any) {
            toast.error("Failed to delete work log.");
            throw err;
        }
    };

    const confirmDeleteSubtask = async () => {
        if (!subtaskToDelete) return;
        setIsDeletingSubtask(true);
        try {
            await deleteSubtask(subtaskToDelete.subtaskId, subtaskToDelete.taskId);
            setSubtaskToDelete(null);
            await refreshData();
        } catch (err: any) {
            toast.error(err.message || "Failed to delete subtask.");
        } finally {
            setIsDeletingSubtask(false);
        }
    };

    const cancelDeleteSubtask = () => setSubtaskToDelete(null);

    const handleDeleteTask = (taskId: string, taskName: string) => {
        setTaskToDelete({ id: taskId, name: taskName });
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!taskToDelete) return;
        
        const taskId = taskToDelete.id;
        const originalTasks = [...myTasks];
        
        // 1. Optimistic Update: Remove from local state immediately
        setMyTasks(prev => prev.filter(t => t.id !== taskId));
        setAllTasks(prev => prev.filter(t => t.id !== taskId));
        setShowDeleteConfirm(false);
        setTaskToDelete(null);
        
        // Close side sheet if it's the deleted task
        if (taskForSheet?.id === taskId) {
            closeTaskSheet();
        }

        try {
            await deleteTask(taskId);
            // Real-time subscription will handle the final sync.
        } catch (err: any) {
            // Rollback on error
            setMyTasks(originalTasks);
            // We don't have originalAllTasks but refreshData will fix it
            refreshData(false);
            toast.error(err.message || "Failed to delete task. Reverting state.");
        }
    };

    const cancelDelete = () => {
        setShowDeleteConfirm(false);
        setTaskToDelete(null);
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

    const handleSignOut = async () => {
        await logout();
    };

    const handleMarkAsRead = async (notification: any) => {
        if (!notification.is_read) {
            await markNotificationAsRead(notification.id);
            await refreshData();
        }
        if (notification.task_id) {
            const task = allTasks.find(t => t.id === notification.task_id);
            if (task) {
                openTaskSheet(task);
                setShowNotifications(false);
            }
        }
    };

    const todayDate = new Date().toISOString().split('T')[0];
    const subtasksToday = useMemo(() => {
        return Object.values(subtasksMap).flat().filter(s => s.date_logged === todayDate && s.employee_id === userId);
    }, [subtasksMap, todayDate, userId]);

    const tasksToday = useMemo(() => {
        const uniqueTaskIds = new Set(subtasksToday.map(s => s.task_id));
        return uniqueTaskIds.size;
    }, [subtasksToday]);

    const hoursToday = useMemo(() => {
        return subtasksToday.reduce((sum, s) => sum + (Number(s.hours_spent) || 0), 0);
    }, [subtasksToday]);
    const capacityLimit = 8;
    const capacityPercentage = useMemo(() => Math.min((hoursToday / capacityLimit) * 100, 100), [hoursToday]);
    const totalTasksCount = myTasks.length;
    const completedTasksCount = myTasks.filter(t => t.status === 'Completed').length;

    const efficiencyPercentage = useMemo(() => {
        if (!myTasks || myTasks.length === 0) return 0;
        
        const totalProgress = myTasks.reduce((acc, task) => {
            const isOverdue = task.status === 'Overdue' || (task.deadline && new Date(task.deadline).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && task.status !== 'Completed');
            if (isOverdue) return acc + 5;

            const taskSubtasks = subtasksMap[task.id] || [];
            if (taskSubtasks.length > 0) {
                const completedCount = taskSubtasks.filter(s => s.is_completed).length;
                return acc + (completedCount / taskSubtasks.length) * 100;
            }
            
            switch (task.status) {
                case 'Completed': return acc + 100;
                case 'In Review': return acc + 80;
                case 'In Progress': return acc + 50;
                case 'Blocked': return acc + 15;
                default: return acc + 0;
            }
        }, 0);
        
        return Math.round(totalProgress / myTasks.length);
    }, [myTasks, subtasksMap]);

    return (
        <div className="flex h-screen bg-[#F9FAFB] overflow-hidden text-[#1d1d1f]">
            <EmployeeSidebar
                userName={userName}
                userAvatarUrl={userAvatarUrl}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isMobileMenuOpen={isMobileMenuOpen}
                setIsMobileMenuOpen={setIsMobileMenuOpen}
                projects={projects}
                userRole={userRole}
                handleSignOut={handleSignOut}
            />

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 flex flex-col min-w-0 bg-[#f8f9fb]">
                <EmployeeHeader 
                    isMobileMenuOpen={isMobileMenuOpen}
                    setIsMobileMenuOpen={setIsMobileMenuOpen}
                    activeTab={activeTab}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    unreadCount={unreadCount}
                    notifications={notifications}
                    showNotifications={showNotifications}
                    setShowNotifications={setShowNotifications}
                    notificationRef={notificationRef}
                    handleMarkAsRead={handleMarkAsRead}
                    markAllNotificationsAsRead={markAllNotificationsAsRead}
                    refreshData={refreshData}
                    userId={userId}
                />

                <div ref={mainRef} className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 custom-scrollbar">
                    <div className="max-w-[1600px] mx-auto">
                        <EmployeeBoardView 
                            userId={userId}
                            userName={userName}
                            profileName={profileName}
                            activeTab={activeTab}
                            viewMode={viewMode}
                            setViewMode={setViewMode}
                            myTasks={myTasks}
                            allTasks={allTasks}
                            employees={employees}
                            projects={projects}
                            subtasksMap={subtasksMap}
                            commentCounts={commentCounts}
                            attachmentCounts={attachmentCounts}
                            efficiencyPercentage={efficiencyPercentage}
                            openTaskSheet={openTaskSheet}
                            handleDeleteTask={handleDeleteTask}
                            handleUpdateTask={handleUpdateTask}
                            editingTaskId={editingTaskId}
                            setEditingTaskId={setEditingTaskId}
                            editTaskData={editTaskData}
                            setEditTaskData={setEditTaskData}
                        />

                        {activeTab === 'schedule' && (
                            <div className="h-[calc(100vh-140px)] min-h-[600px] flex flex-col fade-in -mt-2">
                                <TimelineSchedule 
                                    tasks={allTasks} 
                                    employees={employees} 
                                    onTaskClick={openTaskSheet} 
                                    onEmployeeClick={handleEmployeeClick} 
                                    refreshData={refreshData}
                                    searchFilter={timelineSearchFilter}
                                />
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="fade-in">
                                <SettingsView
                                    userId={userId}
                                    userName={userName}
                                    initialProfileName={profileName || userName}
                                    initialAvatarUrl={userAvatarUrl}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* MODALS */}
                {isSideSheetOpen && taskForSheet && (
                    <TaskDetailsModal 
                        task={taskForSheet} 
                        subtasks={sheetSubtasks} 
                        employees={employees} 
                        onClose={closeTaskSheet} 
                        onUpdateStatus={handleUpdateStatusFromModal} 
                        onUpdatePriority={handleUpdatePriorityFromModal} 
                        isEditable={true} 
                        currentUserId={userId} 
                        isManager={false} 
                        refreshData={refreshData} 
                        onAddSubtask={handleAddSubtaskDirect} 
                        onDeleteSubtask={handleDeleteSubtaskDirect} 
                        onDeleteTask={handleDeleteTask}
                        activeTimers={activeTimers}
                        onStartTimer={handleStartTimer}
                        onStopTimer={handleStopTimer}
                    />
                )}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={cancelDelete} />
                        <Card className="relative w-full max-w-[400px] p-8 bg-white/90 backdrop-blur-xl rounded-[40px] shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-16 h-16 bg-[#ff3b30]/10 rounded-full flex items-center justify-center mb-6"><Trash2 size={32} color="#ff3b30" /></div>
                                <h3 className="text-xl font-black mb-2">Delete Task?</h3>
                                <p className="text-sm text-[#86868b] mb-8">Permanently remove "{taskToDelete?.name}"?</p>
                                <div className="flex gap-3 w-full">
                                    <Button variant="secondary" className="flex-1" onClick={cancelDelete} disabled={isDeletingTask}>Cancel</Button>
                                    <Button className="flex-1 bg-[#ff3b30] hover:bg-[#ff3b30]/90" onClick={confirmDelete} disabled={isDeletingTask}>{isDeletingTask ? 'Deleting...' : 'Delete Task'}</Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
                {subtaskToDelete && (
                    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={cancelDeleteSubtask} />
                        <Card className="relative w-full max-w-[400px] p-8 bg-white/90 backdrop-blur-xl rounded-[40px] shadow-2xl animate-in zoom-in-95 duration-200">
                            <div className="flex flex-col items-center text-center">
                                <div className="w-14 h-14 bg-[#ff3b30]/10 rounded-2xl flex items-center justify-center mb-6"><Trash2 size={24} color="#ff3b30" /></div>
                                <h3 className="text-lg font-black mb-2 uppercase tracking-widest text-[11px]">Confirm Delete Log</h3>
                                <p className="text-[13px] text-[#86868b] mb-8">Delete log "{subtaskToDelete.subtaskName}"?</p>
                                <div className="grid grid-cols-2 gap-3 w-full">
                                    <Button variant="secondary" onClick={cancelDeleteSubtask} disabled={isDeletingSubtask}>Cancel</Button>
                                    <Button className="bg-[#ff3b30] hover:bg-[#e03126]" onClick={confirmDeleteSubtask} disabled={isDeletingSubtask}>{isDeletingSubtask ? 'Deleting...' : 'Delete'}</Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
            </div>

            {/* RIGHT STATS PANEL */}
            <EmployeeRightPanel 
                efficiencyPercentage={efficiencyPercentage}
                totalTasksCount={totalTasksCount}
                completedTasksCount={completedTasksCount}
                formData={formData}
                setFormData={setFormData}
                projects={projects}
                handleSubmit={handleSubmit}
                loading={loading}
            />
        </div>
    );
}

