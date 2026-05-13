"use client";

import dynamic from 'next/dynamic';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Task, Subtask, Profile, Priority, Status, Project, getTasks, saveTask, saveSubtask, inviteMember, addMemberDirectly, updateEmployeeProfile, updateUserPassword, updateTaskPriority, updateTaskStatus, deleteTask, deleteSubtask, getSubtasks, updateTask, markNotificationAsRead, markAllNotificationsAsRead, clearNotifications, Notification, deleteEmployee, sendAlert, updateSubtask, updateSubtaskStatus, WorkloadMap, ActivityLog, getOrgActivityFeed, logout, syncOverdueTasks, getDashboardData } from '@/app/actions/actions';
import { formatAuditEntry } from '@/utils/audit-formatters';
import { format } from 'date-fns';
import { Card, Select, Badge, Button, Input } from '@/components/ui/components';
import { TaskDetailsModal } from '@/components/ui/TaskDetailsModal';
import { ManagerSidebar } from './layout/ManagerSidebar';
import { ManagerHeader } from './layout/ManagerHeader';
import { ManagerBoardView } from './dashboard/ManagerBoardView';
import { ManagerMineView } from './dashboard/ManagerMineView';
import { SettingsView } from './dashboard/SettingsView';

// New Feature Imports
import { ReportsDashboard } from '@/app/dashboard/reports/ReportsDashboard';
import { SprintBoard } from './features/SprintBoard';
import { GanttView } from './features/GanttView';
import { WorkloadView } from './features/WorkloadView';
import { AutomationsManager } from './features/AutomationsManager';

const TimelineSchedule = dynamic(() => import('@/components/ui/TimelineSchedule'), { 
    ssr: false,
    loading: () => <div className="h-96 w-full animate-pulse bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-slate-400">Loading Timeline...</div>
});
const WorkloadHeatmap = dynamic(() => import('@/components/WorkloadHeatmap').then(m => ({ default: m.WorkloadHeatmap })), { 
    ssr: false,
    loading: () => <div className="h-64 w-full animate-pulse bg-slate-100 rounded-2xl flex items-center justify-center font-bold text-slate-400">Loading Workload...</div>
});
import { Pencil, Trash2, Clock } from 'lucide-react';
import TaskRebalancer from "./dashboard/TaskRebalancer";
import { OverloadAlerts } from './dashboard/OverloadAlerts';
import { SmartCalendar } from './features/SmartCalendar';
import { VoiceCommandModal } from './dashboard/VoiceCommand';
import { MorningBriefingWidget } from './dashboard/MorningBriefing';
import { generateMorningBriefingAction, MorningBriefing } from '@/app/actions/briefing';
import { calculateProjectAnalytics, ROIMetrics } from '@/app/actions/analytics';
import { processVoiceCommandAction } from '@/app/actions/voice';
import { startTimer, stopTimer, getMyRunningTimers } from '@/app/actions/time-tracker';
import { useDashboardStore } from '@/lib/dashboard-store';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { toast } from 'sonner';
import { createClient } from '@/utils/supabase/client';

type InitialDashboardData = {
    tasks: Task[];
    profiles: Profile[];
    projectMembers: Profile[];
    projects: Project[];
    subtasks: Subtask[];
    notifications: Notification[];
    workload: WorkloadMap;
    logs: ActivityLog[];
    counts: { comments: Record<string, number>; attachments: Record<string, number> };
}

export default function ManagerDashboard({
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
    initialData?: InitialDashboardData
}) {
    const [activeTab, setActiveTab] = useState<'board' | 'mine' | 'planning' | 'team' | 'settings' | 'reports' | 'sprints' | 'gantt' | 'workload' | 'automations'>('board');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTask, setSelectedTask] = useState<{ task: Task, subtasks: Subtask[] } | null>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const mainRef = React.useRef<HTMLElement>(null);

    // Scroll main content to top when switching tabs
    React.useEffect(() => {
        mainRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }, [activeTab]);

    // ── Supabase-backed store (single source of truth for shared data) ──────────
    const { state: storeState, dispatch: storeDispatch, refresh: storeRefresh } = useDashboardStore();
    const tasks = storeState.tasks;
    const employees = storeState.profiles;
    const projectMembers = storeState.projectMembers;
    const projects = storeState.projects;
    const subtasksMap = storeState.subtasksMap;
    const commentCounts = storeState.commentCounts;
    const attachmentCounts = storeState.attachmentCounts;
    const auditLogs = storeState.logs;

    // Local loading state for initial skeleton (store.isLoading covers refresh cycles)
    const [loading, setLoading] = useState(!initialData);

    // Profile State (profile editing is handled by SettingsView)
    const [profileName] = useState(userName);

    // Team Management Form State
    const [inviteForm, setInviteForm] = useState({ email: '', role: 'employee' });
    const [memberFormMode, setMemberFormMode] = useState<'invite' | 'direct'>('invite');
    const [directAddForm, setDirectAddForm] = useState({ name: '', email: '', role: 'employee', password: '' });
    const [inviteResult, setInviteResult] = useState<{type: 'error' | 'success', text: string} | null>(null);
    const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
    const [editEmpForm, setEditEmpForm] = useState({ name: '', role: 'employee', password: '', email: '' });
    const notifications = storeState.notifications;
    const [showNotifications, setShowNotifications] = useState(false);
    const unreadCount = notifications.filter(n => !n.is_read).length;
    const workloadData = storeState.workload;
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [broadcastForm, setBroadcastForm] = useState({ message: '', type: 'system' as 'urgent' | 'system' });
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [deletingEmpId, setDeletingEmpId] = useState<string | null>(null);
    const [empStatusMsg, setEmpStatusMsg] = useState<{ id: string, text: string } | null>(null);
    const [assignError, setAssignError] = useState<string | null>(null);
    const [showEmployeeDeleteConfirm, setShowEmployeeDeleteConfirm] = useState(false);
    const [employeeToDelete, setEmployeeToDelete] = useState<{ id: string, name: string } | null>(null);


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
    const [subtaskToDelete, setSubtaskToDelete] = useState<{ taskId: string, subtaskId: string, subtaskName: string } | null>(null);
    const [isDeletingSubtask, setIsDeletingSubtask] = useState(false);

    // Assign Task State (used in a modal or side panel later maybe, but for now in board)
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showVoiceCommand, setShowVoiceCommand] = useState(false);
    const [morningBriefing, setMorningBriefing] = useState<MorningBriefing | null>(null);
    const [briefingLoading, setBriefingLoading] = useState(false);
    const [roiMetrics, setRoiMetrics] = useState<ROIMetrics>({
        projectedLoss: 0,
        velocityScore: 0,
        teamPredictability: 0,
        estimatedCompletionDate: "0"
    });
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
    // { taskId → startedAt ISO } — seeded from Supabase on mount, not localStorage
    const [activeTimers, setActiveTimers] = useState<Record<string, string>>({});
    // { taskId → time_entry id } — needed to stop the correct Supabase entry
    const [activeTimerEntryIds, setActiveTimerEntryIds] = useState<Record<string, string>>({});
    const [now, setNow] = useState(new Date());
    const [isSavingLog, setIsSavingLog] = useState(false);
    const [logError, setLogError] = useState<string | null>(null);

    // Editing State (for personal tasks)
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editTaskData, setEditTaskData] = useState<Partial<Task>>({});
    const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
    const [editSubtaskData, setEditSubtaskData] = useState<Partial<Subtask>>({});
    const [newSubtaskData, setNewSubtaskData] = useState<Record<string, { name: string, hours: number, date_logged: string, start_time: string, end_time: string }>>({});
    
    // Optimized refresh with debounce
    const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const debouncedRefresh = (silent = true) => {
        if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = setTimeout(() => {
            fetchDashboardData(silent);
        }, 500);
    };

    // Seed running timers from Supabase on mount (cross-device consistent)
    useEffect(() => {
        getMyRunningTimers().then(running => {
            const timers: Record<string, string> = {};
            const entryIds: Record<string, string> = {};
            for (const [taskId, { entryId, startedAt }] of Object.entries(running)) {
                timers[taskId] = startedAt;
                entryIds[taskId] = entryId;
            }
            if (Object.keys(timers).length > 0) {
                setActiveTimers(timers);
                setActiveTimerEntryIds(entryIds);
            }
        }).catch(() => {
            // If the fetch fails, timers simply start empty — no crash
        });
    }, []);

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // If we have initial data, we can stop loading immediately
        if (initialData) setLoading(false);
        // Reduced frequency to once per minute - enough for "now" precision on dates
        const interval = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(interval);
    }, [initialData]);

    const handleVoiceCommand = async (text: string) => {
        try {
            const res = await processVoiceCommandAction(text, projectId || '');
            if (res.success) {
                toast.success(`AI Executed: ${res.intent.replace('_', ' ')} ${res.taskName ? `"${res.taskName}"` : ""}`);
                fetchDashboardData(true);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to process voice command");
            throw err;
        }
    };

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
            label: mounted ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : '...', 
            color: 'bg-white/40 text-inherit' 
        };
    };

    useEffect(() => {
        if (!initialData) fetchDashboardData();

        // Initialize Supabase client for real-time
        const supabase = createClient();
        
        // Subscribe to tasks, subtasks, profiles, and notifications
        const taskChannel = supabase
            .channel('manager-dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                debouncedRefresh(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, () => {
                debouncedRefresh(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                debouncedRefresh(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => {
                debouncedRefresh(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
                debouncedRefresh(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attachments' }, () => {
                debouncedRefresh(true);
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, () => {
                refreshAuditLogs();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(taskChannel);
        };
    }, []);

    const [isRebalancerOpen, setIsRebalancerOpen] = useState(false);
    const [rebalanceMemberId, setRebalanceMemberId] = useState<string | null>(null);
    const [rebalanceMemberName, setRebalanceMemberName] = useState<string | null>(null);

    useEffect(() => {
        const handleOpenRebalancer = (e: any) => {
            const { memberId, name } = e.detail;
            setRebalanceMemberId(memberId);
            setRebalanceMemberName(name);
            setIsRebalancerOpen(true);
        };
        window.addEventListener('open-rebalancer', handleOpenRebalancer);
        return () => window.removeEventListener('open-rebalancer', handleOpenRebalancer);
    }, []);

    const refreshAuditLogs = async () => {
        try {
            const targetOrgId = tasks[0]?.org_id || orgId;
            if (targetOrgId) {
                const logs = await getOrgActivityFeed(targetOrgId);
                storeDispatch({ type: 'SET_LOGS', payload: logs });
            }
        } catch (error) {
            console.error("Error fetching audit logs:", error);
        }
    };

    const fetchDashboardData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            syncOverdueTasks().catch(err => console.error("Sync error:", err));

            // Hydrate the shared store from Supabase; get raw data back for local concerns
            const data = await storeRefresh(projectId);
            if (!data) return { tasks: [], profiles: [] };

            // Sync the open task modal with the freshly-fetched data
            if (selectedTask) {
                const refreshedTask = data.tasks.find((t: Task) => t.id === selectedTask.task.id);
                if (refreshedTask) {
                    const subtasks = data.subtasks.filter((st: Subtask) => st.task_id === refreshedTask.id);
                    setSelectedTask({ task: refreshedTask, subtasks });
                }
            }

            // Morning Briefing (component-local — not shared state)
            try {
                if (!silent) setBriefingLoading(true);
                const briefingData = await generateMorningBriefingAction(userId);
                setMorningBriefing(briefingData);
            } catch (err) {
                console.error("Failed to fetch briefing:", err);
            } finally {
                if (!silent) setBriefingLoading(false);
            }

            // ROI Metrics (component-local)
            const roi = await calculateProjectAnalytics(data.tasks);
            setRoiMetrics(roi);

            return { tasks: data.tasks, profiles: data.profiles };
        } catch (error) {
            console.error("Error refreshing dashboard data:", error);
            return { tasks: [], profiles: [] };
        } finally {
            setLoading(false);
        }
    }, [projectId, selectedTask, storeRefresh]);

    // --- Timeline Logic ---


    const handleEmployeeActivityClick = (employee: Profile) => {
        setSearchQuery(employee.name);
        setActiveTab('board');
        // Scroll to top to ensure the search results are visible
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleTaskClick = (task: Task) => {
        const subtasks = subtasksMap[task.id] || [];
        setSelectedTask({ task, subtasks });
    };

    const handleLogSubmit = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        setLogError(null);
        setIsSavingLog(true);

        const tempId = `temp-${Date.now()}`;
        const newTaskData = {
            ...logForm,
            employee_id: userId,
            hours_spent: Number(logForm.hours_spent),
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

        storeDispatch({ type: 'UPSERT_TASK', payload: optimisticTask });

        // Reset form immediately for snappiness
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

        try {
            const result = await saveTask(newTaskData);
            if (result.success) {
                await fetchDashboardData(true);
            } else {
                storeRefresh(projectId); // rollback: re-hydrate from Supabase
                setLogError(result.error || 'Failed to save task.');
            }
        } catch (err: any) {
            storeRefresh(projectId);
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
        const startedAt = new Date().toISOString();
        setActiveTimers(prev => ({ ...prev, [subtaskId]: startedAt }));
        // Persist to Supabase so other devices/refreshes can resume the timer
        startTimer(taskId).then(entry => {
            setActiveTimerEntryIds(prev => ({ ...prev, [subtaskId]: entry.id }));
        }).catch(() => {
            // Server-side persist failed — UI timer still works, will just miss cross-device sync
        });
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
                    fetchDashboardData(true);
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

        // Close the Supabase time entry so other devices see the timer as stopped
        const entryId = activeTimerEntryIds[subtaskId];
        if (entryId) {
            stopTimer(entryId).catch(() => {
                // Non-fatal — hours were already written to the subtask above
            });
            setActiveTimerEntryIds(prev => {
                const next = { ...prev };
                delete next[subtaskId];
                return next;
            });
        }
    };

    const handleUpdateTask = async (taskId: string) => {
        storeDispatch({ type: 'PATCH_TASK', payload: { id: taskId, ...editTaskData } });
        try {
            await updateTask(taskId, editTaskData);
            setEditingTaskId(null);
            fetchDashboardData(true);
        } catch (err: any) {
            storeRefresh(projectId);
            toast.error(err.message || "Failed to update task.");
        }
    };

    const handleToggleSubtask = async (taskId: string, subtaskId: string, is_completed: boolean) => {
        const existing = subtasksMap[taskId]?.find(s => s.id === subtaskId);
        if (existing) storeDispatch({ type: 'UPSERT_SUBTASK', payload: { ...existing, is_completed } });
        try {
            await updateSubtaskStatus(subtaskId, taskId, is_completed);
            fetchDashboardData(true);
        } catch (err: any) {
            console.error("Failed to toggle subtask:", err);
            storeRefresh(projectId);
        }
    };

    const handleAddSubtaskDirect = async (taskId: string, name: string, hours: number, date: string, startTime: string, endTime: string) => {
        try {
            await saveSubtask({
                task_id: taskId,
                name: name.trim(),
                hours_spent: hours,
                date_logged: date,
                start_time: startTime,
                end_time: endTime,
                employee_id: userId,
                is_completed: true
            });
            fetchDashboardData(true);
        } catch (err: any) {
            toast.error(err.message || "Failed to add work log.");
            throw err;
        }
    };

    const handleDeleteSubtaskDirect = async (taskId: string, subtaskId: string, _subtaskName: string) => {
        try {
            await deleteSubtask(subtaskId, taskId);
            fetchDashboardData(true);
        } catch (err: any) {
            toast.error(err.message || "Failed to delete work log.");
            throw err;
        }
    };

    const handleAddSubtask = async (taskId: string) => {
        const data = newSubtaskData[taskId];
        if (!data || !data.name) return;

        try {
            await saveSubtask({
                task_id: taskId,
                name: data.name,
                hours_spent: Number(data.hours),
                date_logged: data.date_logged,
                start_time: data.start_time,
                end_time: data.end_time,
                employee_id: userId,
                is_completed: true
            });

            setNewSubtaskData(prev => ({ ...prev, [taskId]: { name: '', hours: 8, date_logged: new Date().toISOString().split('T')[0], start_time: '09:00', end_time: '17:00' } }));
            fetchDashboardData(true);
        } catch (err: any) {
            toast.error(err.message || "Failed to add work log.");
        }
    };

    const handleDeleteSubtask = (taskId: string, subtaskId: string, subtaskName: string) => {
        setSubtaskToDelete({ taskId, subtaskId, subtaskName });
    };

    const confirmDeleteSubtask = async () => {
        if (!subtaskToDelete) return;
        setIsDeletingSubtask(true);
        try {
            await deleteSubtask(subtaskToDelete.subtaskId, subtaskToDelete.taskId);
            setSubtaskToDelete(null);
            fetchDashboardData(true);
        } catch (err: any) {
            console.error("Delete subtask error:", err);
            toast.error(err.message || "Failed to delete subtask.");
        } finally {
            setIsDeletingSubtask(false);
        }
    };

    const cancelDeleteSubtask = () => {
        setSubtaskToDelete(null);
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
            fetchDashboardData(true);
        } catch (err: any) {
            toast.error(err.message || "Failed to update work log.");
        }
    };

    const handleUpdateStatusFromModal = async (taskId: string, status: Status) => {
        setIsUpdatingStatus(true);
        storeDispatch({ type: 'PATCH_TASK', payload: { id: taskId, status } });
        if (selectedTask?.task.id === taskId) {
            setSelectedTask({ ...selectedTask, task: { ...selectedTask.task, status } });
        }
        try {
            await updateTaskStatus(taskId, status);
            const data = await storeRefresh(projectId);
            if (selectedTask?.task.id === taskId && data) {
                const updatedTask = data.tasks.find((t: Task) => t.id === taskId);
                if (updatedTask) {
                    const subtasks = data.subtasks.filter((s: Subtask) => s.task_id === taskId);
                    setSelectedTask({ task: updatedTask, subtasks });
                }
            }
        } catch (error) {
            storeRefresh(projectId);
            toast.error("Failed to update status");
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleUpdatePriorityFromModal = async (taskId: string, priority: Priority) => {
        setIsUpdatingStatus(true);
        storeDispatch({ type: 'PATCH_TASK', payload: { id: taskId, priority } });
        if (selectedTask?.task.id === taskId) {
            setSelectedTask({ ...selectedTask, task: { ...selectedTask.task, priority } });
        }
        try {
            await updateTaskPriority(taskId, priority);
            const data = await storeRefresh(projectId);
            if (selectedTask?.task.id === taskId && data) {
                const updatedTask = data.tasks.find((t: Task) => t.id === taskId);
                if (updatedTask) {
                    const subtasks = data.subtasks.filter((s: Subtask) => s.task_id === taskId);
                    setSelectedTask({ task: updatedTask, subtasks });
                }
            }
        } catch (error) {
            storeRefresh(projectId);
            toast.error("Failed to update priority");
        } finally {
            setIsUpdatingStatus(false);
        }
    };


    // --- Board Stats ---
    const boardStats = useMemo(() => {
        const filteredTasks = tasks.filter(t => 
            t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            employees.find(p => p.id === t.employee_id)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );

        const isOverdue = (t: Task) => (t.status === 'Overdue' || (t.deadline && new Date(t.deadline).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && t.status !== 'Completed'));
        const groupTasksByStatus = (status: Status) => {
            if (status === 'Overdue') return filteredTasks.filter(isOverdue);
            return filteredTasks.filter(t => t.status === status && !isOverdue(t));
        };

        const total = filteredTasks.length;
        const completed = groupTasksByStatus('Completed').length;
        const inProgress = groupTasksByStatus('In Progress').length;
        const draft = groupTasksByStatus('To Do').length;
        const inReview = groupTasksByStatus('In Review').length;
        const overdueCount = groupTasksByStatus('Overdue').length;

        return { total, completed, inProgress, draft, inReview, overdue: overdueCount };
    }, [tasks, searchQuery, employees]);

    const heatmapData = useMemo(() => {
        const isOverdue = (t: Task) => (t.status === 'Overdue' || (t.deadline && new Date(t.deadline).setHours(0,0,0,0) < new Date().setHours(0,0,0,0) && t.status !== 'Completed'));
        const active = tasks.filter(t => (t.priority === 'High' || t.priority === 'Urgent') && t.status !== 'Completed' && !isOverdue(t));
        const overdue = tasks.filter(t => isOverdue(t));
        
        return { 
            active: active.map(t => ({ ...t, employee: employees.find(e => e.id === t.employee_id)?.name })), 
            overdue: overdue.map(t => ({ ...t, employee: employees.find(e => e.id === t.employee_id)?.name })) 
        };
    }, [tasks, employees]);

    // --- Handlers ---
    const handleDirectAdd = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        setInviteResult(null);
        try {
            const result = await addMemberDirectly(directAddForm);
            if (result.success) {
                setInviteResult({ type: 'success', text: `Successfully added ${directAddForm.name}!` });
                setDirectAddForm({ name: '', email: '', role: 'employee', password: '' });
                fetchDashboardData();
            } else {
                setInviteResult({ type: 'error', text: result.error || 'Failed to add member.' });
            }
        } catch (err: any) {
            setInviteResult({ type: 'error', text: err.message || 'Failed to add member.' });
        }
    };

    const handleInviteMember = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        setInviteResult(null);
        try {
            const result = await inviteMember(inviteForm.email, inviteForm.role);
            if (result.success) {
                setInviteResult({ 
                    type: 'success', 
                    text: result.error ? `Success: ${result.error}` : `Invitation sent to ${inviteForm.email}` 
                });
                setInviteForm({ email: '', role: 'employee' });
                fetchDashboardData(); 
            } else {
                setInviteResult({ type: 'error', text: result.error || 'Failed to send invite.' });
            }
        } catch (err: any) {
            setInviteResult({ type: 'error', text: err.message || 'Failed to send invite.' });
        }
    };

    const handleSaveEdit = async (empId: string) => {
        try {
            const profileRes = await updateEmployeeProfile(empId, editEmpForm.name, editEmpForm.role, editEmpForm.email);
            if (profileRes && profileRes.error) {
                toast.error(profileRes.error);
                return;
            }

            if (editEmpForm.password) {
                const passRes = await updateUserPassword(empId, editEmpForm.password);
                if (passRes && passRes.error) {
                    toast.error(passRes.error);
                    return;
                }
            }
            
            setEditingEmpId(null);
            setEditEmpForm({ name: '', role: 'employee', password: '', email: '' });
            fetchDashboardData();
        } catch (err: any) {
            toast.error(err.message || 'An unexpected error occurred.');
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
            storeDispatch({ type: 'DELETE_PROFILE', payload: employeeToDelete.id });
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

        const taskId = taskToDelete.id;
        const originalSelectedTask = selectedTask;

        setIsDeletingTask(true);
        storeDispatch({ type: 'DELETE_TASK', payload: taskId });
        setShowTaskDeleteConfirm(false);
        setTaskToDelete(null);
        if (selectedTask?.task.id === taskId) setSelectedTask(null);

        try {
            await deleteTask(taskId);
        } catch (err: any) {
            storeRefresh(projectId);
            setSelectedTask(originalSelectedTask);
            toast.error(err.message || "Failed to delete task. Reverting state.");
        } finally {
            setIsDeletingTask(false);
        }
    };

    const cancelDeleteTask = () => {
        setShowTaskDeleteConfirm(false);
        setTaskToDelete(null);
    };

    const handleAssignTask = async (e: React.SyntheticEvent) => {
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
            fetchDashboardData();
        } catch (err: any) {
            setAssignError(err.message || "Error assigning task");
        }
    };

    const handleBroadcastAlert = async (e: React.SyntheticEvent) => {
        e.preventDefault();
        if (!broadcastForm.message) return;
        setIsBroadcasting(true);
        try {
            await sendAlert('all', broadcastForm.message, broadcastForm.type as any);
            setShowBroadcastModal(false);
            setBroadcastForm({ message: '', type: 'system' });
            toast.success("Broadcast alert sent successfully!");
            fetchDashboardData(true);
        } catch (err: any) {
            toast.error("Failed to send broadcast: " + err.message);
        } finally {
            setIsBroadcasting(false);
        }
    };

    const handleMarkAsRead = async (n: any) => {
        storeDispatch({ type: 'MARK_NOTIFICATION_READ', payload: n.id });
        try {
            if (!n.is_read) {
                await markNotificationAsRead(n.id);
                debouncedRefresh(true);
            }
            if (n.task_id) {
                const task = tasks.find(t => t.id === n.task_id);
                if (task) {
                    handleTaskClick(task);
                    setShowNotifications(false);
                } else {
                    toast.error("Task not found or has been deleted");
                    setShowNotifications(false);
                }
            } else {
                setShowNotifications(false);
            }
        } catch (error) {
            console.error("Error marking notification as read:", error);
            storeRefresh(projectId);
            toast.error("Failed to update notification");
        }
    };

    const handleClearAll = async () => {
        storeDispatch({ type: 'CLEAR_NOTIFICATIONS' });
        try {
            await clearNotifications(userId);
            toast.success("Notifications cleared");
            debouncedRefresh(true);
        } catch (error) {
            console.error("Error clearing notifications:", error);
            storeRefresh(projectId);
            toast.error("Failed to clear notifications");
        }
    };

    // Optimized rendering: show the layout immediately if we have initial data
    // Only show the global loader if we have NO data and are still loading
    if (loading && tasks.length === 0) {
        return (
            <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
                <div className="w-12 h-12 border-4 border-[#0051e6] border-t-transparent rounded-full animate-spin mb-4"></div>
                <div className="text-xl font-bold text-[#1d1d1f] animate-pulse">Initializing Management System...</div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#f5f5f7] overflow-hidden">
            <ManagerSidebar
                userName={userName}
                userAvatarUrl={userAvatarUrl}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isMobileMenuOpen={isMobileMenuOpen}
                setIsMobileMenuOpen={setIsMobileMenuOpen}
                projects={projects}
                userRole={userRole}
                logout={logout}
            />

            {/* --- MAIN CONTENT --- */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <ManagerHeader 
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
                    clearNotifications={handleClearAll}
                    refreshData={() => fetchDashboardData(true)}
                    userId={userId}
                    setActiveTab={setActiveTab}
                    setShowAssignModal={setShowAssignModal}
                    onOpenVoiceCommand={() => setShowVoiceCommand(true)}
                />

                <main ref={mainRef} className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
                    {activeTab === 'board' && (
                        <div className="space-y-6">
                            <MorningBriefingWidget 
                                briefing={morningBriefing}
                                loading={briefingLoading}
                                onAction={(type, metadata) => {
                                    if (type === 'bottleneck' && metadata?.employeeId) {
                                        setRebalanceMemberId(metadata.employeeId);
                                        setRebalanceMemberName(employees.find(e => e.id === metadata.employeeId)?.name || 'Member');
                                        setIsRebalancerOpen(true);
                                    } else if (type === 'alert') {
                                        setActiveTab('gantt');
                                    }
                                }}
                            />
                            <OverloadAlerts 
                                tasks={tasks} 
                                subtasksMap={subtasksMap}
                                employees={employees} 
                                onRebalance={(id, name) => {
                                    setRebalanceMemberId(id);
                                    setRebalanceMemberName(name);
                                    setIsRebalancerOpen(true);
                                }} 
                            />
                            <ManagerBoardView 
                                userName={userName}
                                tasks={tasks}
                                employees={employees}
                                subtasksMap={subtasksMap}
                                commentCounts={commentCounts}
                                attachmentCounts={attachmentCounts}
                                boardStats={boardStats}
                                heatmapData={heatmapData}
                                searchQuery={searchQuery}
                                handleTaskClick={handleTaskClick}
                                handleDeleteTask={handleDeleteTask}
                                formatTaskDate={formatTaskDate}
                            />
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div className="fade-in p-8 max-w-5xl mx-auto space-y-6">
                            <ReportsDashboard
                                range={30}
                                stats={{
                                    total: tasks.length,
                                    completed: tasks.filter(t => t.status === 'Completed').length,
                                    overdue: tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'Completed').length,
                                    totalHours: Math.round(tasks.reduce((a, t) => a + (t.hours_spent || 0), 0)),
                                    memberCount: employees.length,
                                    workspaceCount: 1,
                                    projectCount: 0,
                                    completionRate: tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'Completed').length / tasks.length) * 100) : 0,
                                    avgCycleDays: 0,
                                    sparklines: Array.from({ length: 4 }, (_, i) => {
                                        const end = new Date(); end.setDate(end.getDate() - i * 7);
                                        const start = new Date(end); start.setDate(start.getDate() - 7);
                                        const pt = tasks.filter(t => t.created_at >= start.toISOString() && t.created_at < end.toISOString());
                                        return { created: pt.length, completed: pt.filter(t => t.status === 'Completed').length, overdue: 0, hours: 0 };
                                    }).reverse(),
                                }}
                                byStatus={['To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'].map(s => ({ status: s, count: tasks.filter(t => t.status === s).length }))}
                                byPriority={['Urgent', 'High', 'Medium', 'Low'].map(p => ({ priority: p, count: tasks.filter(t => t.priority === p).length }))}
                                byMember={employees.map(e => {
                                    const mt = tasks.filter(t => t.employee_id === e.id && t.status !== 'Blocked');
                                    const active = mt.filter(t => t.status !== 'Completed');
                                    const overdue = mt.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'Completed').length;
                                    const completed = mt.filter(t => t.status === 'Completed').length;
                                    
                                    // Burnout Risk Logic - Ignoring Blocked tasks
                                    const urgent = active.filter(t => t.priority === 'Urgent' || t.priority === 'High').length;
                                    const score = (overdue * 3) + active.length + (urgent * 2);
                                    const burnoutRisk = score > 15 ? 'High' : score > 8 ? 'Medium' : 'Low';

                                    return {
                                        user_id: e.id,
                                        name: e.name,
                                        role: e.role || 'employee',
                                        total: mt.length,
                                        completed,
                                        overdue,
                                        hours: Math.round(mt.reduce((a, t) => a + (t.hours_spent || 0), 0)),
                                        completionRate: mt.length > 0 ? Math.round((completed / mt.length) * 100) : 0,
                                        burnoutRisk
                                    };
                                })}
                                byProject={[]}
                                byWorkspace={[]}
                                weeklyTrend={Array.from({ length: 8 }, (_, i) => {
                                    const end = new Date(); end.setDate(end.getDate() - i * 7);
                                    const start = new Date(end); start.setDate(start.getDate() - 7);
                                    const s = start.toISOString(); const e = end.toISOString();
                                    return {
                                        label: i === 0 ? 'This Wk' : i === 1 ? 'Last Wk' : `W-${i}`,
                                        weekStart: s.split('T')[0],
                                        created: tasks.filter(t => t.created_at >= s && t.created_at < e).length,
                                        completed: tasks.filter(t => t.status === 'Completed' && t.created_at >= s && t.created_at < e).length,
                                    };
                                }).reverse()}
                                dailyActivity={Array.from({ length: 84 }, (_, i) => {
                                    const d = new Date(); d.setDate(d.getDate() - (83 - i));
                                    const dateStr = d.toISOString().split('T')[0];
                                    return { date: dateStr, count: tasks.filter(t => t.created_at.startsWith(dateStr)).length };
                                })}
                                cycleTimeBuckets={[]}
                                agingBuckets={[
                                    { label: '< 7d', count: tasks.filter(t => t.status !== 'Completed' && (Date.now() - new Date(t.created_at).getTime()) < 7 * 86400000).length, color: '#22be66' },
                                    { label: '7–14d', count: tasks.filter(t => t.status !== 'Completed' && (Date.now() - new Date(t.created_at).getTime()) >= 7 * 86400000 && (Date.now() - new Date(t.created_at).getTime()) < 14 * 86400000).length, color: '#0051e6' },
                                    { label: '14–30d', count: tasks.filter(t => t.status !== 'Completed' && (Date.now() - new Date(t.created_at).getTime()) >= 14 * 86400000 && (Date.now() - new Date(t.created_at).getTime()) < 30 * 86400000).length, color: '#f5a623' },
                                    { label: '30+d', count: tasks.filter(t => t.status !== 'Completed' && (Date.now() - new Date(t.created_at).getTime()) >= 30 * 86400000).length, color: '#ff3b30' },
                                ]}
                                funnelData={['To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'].map(s => ({
                                    name: s,
                                    value: tasks.filter(t => t.status === s).length,
                                    fill: { 'To Do': '#86868b', 'In Progress': '#0051e6', 'In Review': '#5e5ce6', 'Blocked': '#ff3b30', 'Completed': '#22be66' }[s] ?? '#0051e6',
                                }))}
                                priorityStatusMatrix={['Urgent', 'High', 'Medium', 'Low'].flatMap(p => 
                                    ['To Do', 'In Progress', 'In Review', 'Blocked', 'Completed'].map(s => ({
                                        priority: p,
                                        status: s,
                                        count: tasks.filter(t => t.priority === p && t.status === s).length
                                    }))
                                )}
                                activityByType={[
                                    { type: 'INSERT', label: 'Created', count: auditLogs.filter(l => l.type.includes('created')).length },
                                    { type: 'UPDATE', label: 'Updated', count: auditLogs.filter(l => l.type.includes('updated') || l.type.includes('changed')).length },
                                    { type: 'DELETE', label: 'Deleted', count: auditLogs.filter(l => l.type.includes('deleted')).length },
                                ]}
                                roi={roiMetrics}
                                overdueList={tasks
                                    .filter(t => (t.deadline && new Date(t.deadline) < new Date() && t.status !== 'Completed') || t.status === 'Overdue')
                                    .map(t => ({
                                        id: t.id,
                                        name: t.name,
                                        priority: t.priority || 'Low',
                                        daysOverdue: t.deadline ? Math.round((Date.now() - new Date(t.deadline).getTime()) / 86400000) : 0,
                                        assignee: employees.find(e => e.id === t.employee_id)?.name || 'Unassigned',
                                        status: t.status,
                                    }))
                                    .sort((a, b) => b.daysOverdue - a.daysOverdue)
                                    .slice(0, 15)}
                                memberEfficiency={employees.map(e => {
                                    const mt = tasks.filter(t => t.employee_id === e.id);
                                    const completed = mt.filter(t => t.status === 'Completed').length;
                                    return {
                                        name: e.name,
                                        tasks: completed,
                                        hours: Math.round(mt.reduce((a, t) => a + (t.hours_spent || 0), 0)),
                                        completionRate: mt.length > 0 ? Math.round((completed / mt.length) * 100) : 0,
                                    };
                                }).filter(m => m.tasks > 0 || m.hours > 0)}
                            />
                        </div>
                    )}                    {activeTab === 'planning' && (
                        <div className="fade-in p-2">
                            <SmartCalendar 
                                tasks={tasks}
                                employees={employees}
                                onTaskClick={handleTaskClick}
                                onDateClick={(date) => {
                                    setAssignForm({ ...assignForm, deadline: format(date, 'yyyy-MM-dd') });
                                    setShowAssignModal(true);
                                }}
                                onUpdateTask={async (id, updates) => {
                                    try {
                                        await updateTask(id, updates);
                                        await fetchDashboardData(true);
                                        toast.success("AI: Task rescheduled successfully");
                                    } catch (err) {
                                        toast.error("Failed to reschedule task");
                                    }
                                }}
                            />
                        </div>
                    )}

                    {activeTab === 'sprints' && (
                        <div className="fade-in p-8 max-w-5xl mx-auto space-y-6">
                            <div>
                                <h1 className="text-2xl font-black text-[#1d1d1f] tracking-tight">Agile Sprint Board</h1>
                                <p className="text-sm text-[#86868b] mt-1">Organize work into time-boxed iterations.</p>
                            </div>
                            <SprintBoard orgId={orgId} workspaceId={""} sprints={[]} sprintTasks={{}} backlogTasks={[]} />
                        </div>
                    )}

                    {activeTab === 'gantt' && (
                        <div className="fade-in p-8 space-y-6">
                            <div>
                                <h1 className="text-2xl font-black text-[#1d1d1f] tracking-tight">Timeline & Gantt</h1>
                                <p className="text-sm text-[#86868b] mt-1">Visualize project dependencies and schedules.</p>
                            </div>
                            <GanttView tasks={tasks} profiles={projectId ? projectMembers : employees} onTaskClick={handleTaskClick} />
                        </div>
                    )}

                    {activeTab === 'workload' && (
                        <div className="fade-in p-8 max-w-7xl mx-auto space-y-6">
                            <div>
                                <h1 className="text-2xl font-black text-[#1d1d1f] tracking-tight">Team Workload</h1>
                                <p className="text-sm text-[#86868b] mt-1">Monitor capacity and prevent burnout.</p>
                            </div>
                            <WorkloadView
                                members={Object.entries(workloadData || {}).map(([userId, data]) => {
                                    const employee = employees.find(e => e.id === userId);
                                    const tasks_by_date: Record<string, { count: number; hours: number }> = {};
                                    for (const [date, day] of Object.entries(data.days || {})) {
                                        tasks_by_date[date] = { count: day.tasks, hours: day.hours };
                                    }
                                    return {
                                        user_id: userId,
                                        role: employee?.role ?? 'employee',
                                        name: data.name ?? employee?.name,
                                        avatar_url: data.avatar_url ?? employee?.avatar_url ?? null,
                                        tasks_by_date,
                                    };
                                })}
                            />
                        </div>
                    )}

                    {activeTab === 'automations' && (
                        <div className="fade-in p-8 max-w-5xl mx-auto space-y-6">
                            <div>
                                <h1 className="text-2xl font-black text-[#1d1d1f] tracking-tight">Automations Center</h1>
                                <p className="text-sm text-[#86868b] mt-1">Streamline your workflow with custom trigger-action rules.</p>
                            </div>
                            <AutomationsManager rules={[]} />
                        </div>
                    )}

                    {activeTab === 'planning' && (
                        <div className="flex flex-col gap-8 h-[calc(100vh-100px)] overflow-y-auto custom-scrollbar pr-2 pb-10 fade-in">
                            <WorkloadHeatmap data={workloadData || {}} />
                            
                            <div className="bg-white rounded-[32px] border border-[#e5e5ea] overflow-hidden flex-shrink-0 min-h-[700px] shadow-[0_8px_32px_rgba(0,0,0,0.04)]">
                                <TimelineSchedule 
                                    tasks={tasks} 
                                    employees={projectId ? projectMembers : employees} 
                                    onTaskClick={handleTaskClick}
                                    onEmployeeClick={handleEmployeeActivityClick}
                                    refreshData={fetchDashboardData}
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
                                        .slice(0, 20) // Limit to top 20 for performance
                                        .map((log) => (
                                            <div key={log.id} className="flex gap-4 p-4 rounded-2xl hover:bg-[#f5f5f7] transition-all border border-transparent hover:border-[#eceef0] group/log">
                                                <UserAvatar
                                                    name={log.actor_name || 'S'}
                                                    avatarUrl={employees.find(e => e.id === log.actor_id)?.avatar_url}
                                                    className="w-10 h-10 rounded-full bg-white flex-shrink-0 border border-[#eceef0] shadow-sm group-hover/log:border-[#0051e6] transition-colors"
                                                    textClassName="font-black text-[12px] text-[#1d1d1f]"
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[13px] font-medium text-[#1d1d1f] leading-relaxed group-hover/log:text-black transition-colors">
                                                        {formatAuditEntry(log)}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1.5">
                                                        <span className="text-[9px] font-black text-[#86868b] uppercase tracking-widest bg-[#f5f5f7] px-2 py-0.5 rounded-md border border-[#eceef0]">
                                                            {log.type?.replace(/_/g, ' ') || 'Activity'}
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
                                <Button onClick={() => setShowBroadcastModal(true)} className="w-full sm:w-auto rounded-lg h-9 px-6 bg-[#0051e6] text-white font-bold text-[10px] tracking-tight shadow-sm hover:bg-[#005bb7] transition-colors">📢 BROADCAST ALERT</Button>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card className="p-6 rounded-2xl border-[#eceef0]">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base font-black text-[#1d1d1f] tracking-tight">Team Onboarding</h3>
                                    <div className="flex bg-[#f5f5f7] p-0.5 rounded-lg border border-[#e5e5ea]">
                                        <button 
                                            onClick={() => setMemberFormMode('invite')} 
                                            className={`px-3 py-1 rounded-md text-[9px] font-black tracking-tight transition-all ${memberFormMode === 'invite' ? 'bg-white shadow-sm text-[#0051e6]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                                        >
                                            INVITE
                                        </button>
                                        <button 
                                            onClick={() => setMemberFormMode('direct')} 
                                            className={`px-3 py-1 rounded-md text-[9px] font-black tracking-tight transition-all ${memberFormMode === 'direct' ? 'bg-white shadow-sm text-[#0051e6]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                                        >
                                            DIRECT
                                        </button>
                                    </div>
                                </div>

                                {memberFormMode === 'invite' ? (
                                    <form onSubmit={handleInviteMember} className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Email Address</label>
                                            <input type="email" required value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })} placeholder="colleague@company.com" className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold outline-none focus:ring-1 ring-[#0051e6]" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Role</label>
                                            <select 
                                                value={inviteForm.role} 
                                                onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                                                className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#0051e6]"
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
                                        <button type="submit" className="w-full h-10 rounded-xl bg-[#0051e6] text-white font-black tracking-widest text-[10px] mt-2 shadow-sm hover:bg-[#005bb7] transition-colors">SEND INVITATION</button>
                                    </form>
                                ) : (
                                    <form onSubmit={handleDirectAdd} className="space-y-4">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Full Name</label>
                                                <input required value={directAddForm.name} onChange={e => setDirectAddForm({ ...directAddForm, name: e.target.value })} placeholder="John Doe" className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold outline-none focus:ring-1 ring-[#0051e6]" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Role</label>
                                                <select 
                                                    value={directAddForm.role} 
                                                    onChange={(e) => setDirectAddForm({ ...directAddForm, role: e.target.value })}
                                                    className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold appearance-none cursor-pointer"
                                                >
                                                    <option value="employee">Employee</option>
                                                    <option value="manager">Manager</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Email Address</label>
                                            <input type="email" required value={directAddForm.email} onChange={e => setDirectAddForm({ ...directAddForm, email: e.target.value })} placeholder="email@example.com" className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold outline-none focus:ring-1 ring-[#0051e6]" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[9px] font-black uppercase tracking-widest text-[#86868b] ml-4">Temp Password</label>
                                            <input type="text" required value={directAddForm.password} onChange={e => setDirectAddForm({ ...directAddForm, password: e.target.value })} placeholder="Min 6 chars" className="w-full h-10 rounded-xl bg-[#f5f5f7] border-none px-5 text-[11px] font-bold outline-none focus:ring-1 ring-[#0051e6]" />
                                        </div>
                                        
                                        {inviteResult && (
                                            <p className={`text-[10px] font-bold px-4 ${inviteResult.type === 'error' ? 'text-[#ff3b30]' : 'text-[#34c759]'}`}>
                                                {inviteResult.text}
                                            </p>
                                        )}
                                        <button type="submit" className="w-full h-10 rounded-xl bg-[#1d1d1f] text-white font-black tracking-widest text-[10px] mt-2 shadow-sm hover:bg-black transition-colors">CREATE MEMBER ACCOUNT</button>
                                    </form>
                                )}
                            </Card>

                            <Card className="p-6 rounded-2xl border-[#eceef0]">
                                <h3 className="text-base font-black mb-4 text-[#1d1d1f] tracking-tight">
                                    {projectId ? 'Project Members' : 'Active Members'}
                                </h3>
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    {(projectId ? projectMembers : employees).filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())).map(emp => (
                                        <div key={emp.id} className="p-3 bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] flex items-center justify-between group hover:border-[#0051e6] transition-colors min-w-0">
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <UserAvatar
                                                    name={emp.name}
                                                    avatarUrl={emp.avatar_url}
                                                    className="w-8 h-8 rounded-full bg-white border border-[#e5e5ea] shadow-sm group-hover:bg-[#0051e6] transition-all flex-shrink-0"
                                                    textClassName="text-[10px] font-black text-[#1d1d1f] group-hover:text-white"
                                                />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className="text-[11px] font-bold text-[#1d1d1f] truncate leading-tight">{emp.name}</p>
                                                            {emp.role === 'manager' && <Badge className="bg-[#0051e6] text-white border-none text-[7px] px-1.5 flex-shrink-0">ADMIN</Badge>}
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
                                                        setEditEmpForm({ name: emp.name || '', role: (emp.role as any) || 'employee', password: '', email: emp.email || '' });
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
                        <ManagerMineView 
                            userId={userId}
                            userName={userName}
                            orgId={orgId}
                            projectId={projectId}
                            tasks={tasks}
                            employees={employees}
                            projects={projects}
                            subtasksMap={subtasksMap}
                            editingTaskId={editingTaskId}
                            setEditingTaskId={setEditingTaskId}
                            editTaskData={editTaskData}
                            setEditTaskData={setEditTaskData}
                            handleUpdateTask={handleUpdateTask}
                            setSelectedTask={setSelectedTask}
                            handleToggleSubtask={handleToggleSubtask}
                            editingSubtaskId={editingSubtaskId}
                            setEditingSubtaskId={setEditingSubtaskId}
                            editSubtaskData={editSubtaskData}
                            setEditSubtaskData={setEditSubtaskData}
                            handleSaveSubtaskEdit={handleSaveSubtaskEdit}
                            logForm={logForm}
                            setLogForm={setLogForm}
                            handleLogSubmit={handleLogSubmit}
                            isSavingLog={isSavingLog}
                            logError={logError}
                            mounted={mounted}
                            activeTimers={activeTimers}
                            handleStartTimer={handleStartTimer}
                            handleStopTimer={handleStopTimer}
                            formatElapsed={formatElapsed}
                            newSubtaskData={newSubtaskData}
                            setNewSubtaskData={setNewSubtaskData}
                            handleAddSubtask={handleAddSubtask}
                            handleDeleteSubtask={handleDeleteSubtask}
                        />
                    )}

                    {activeTab === 'settings' && (
                        <div className="fade-in">
                            <SettingsView
                                userId={userId}
                                userName={userName}
                                initialProfileName={profileName}
                                initialAvatarUrl={userAvatarUrl}
                                isManager={true}
                            />
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
                                setEditEmpForm({ name: '', role: 'employee', password: '', email: '' });
                            }} className="w-10 h-10 rounded-full bg-[#f5f5f7] flex items-center justify-center font-bold hover:bg-[#e5e5ea]">✕</button>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(editingEmpId); }} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Full Name</label>
                                <Input required value={editEmpForm.name} onChange={e => setEditEmpForm({ ...editEmpForm, name: e.target.value })} className="h-14 rounded-[20px] bg-[#f5f5f7] border-none px-6 font-bold" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Email Address</label>
                                <Input required type="email" value={editEmpForm.email} onChange={e => setEditEmpForm({ ...editEmpForm, email: e.target.value })} className="h-14 rounded-[20px] bg-[#f5f5f7] border-none px-6 font-bold" />
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
                            <Button type="submit" className="w-full h-16 rounded-[28px] font-black tracking-widest shadow-2xl shadow-[#0051e6]/30 mt-4">SAVE CHANGES</Button>
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
                                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${isSelected ? 'bg-[#0051e6] text-white shadow-md' : 'bg-white text-[#86868b] hover:bg-[#e5e5ea]'}`}
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
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Start Date</label>
                                        <Input type="date" required value={assignForm.start_date} onChange={e => setAssignForm({ ...assignForm, start_date: e.target.value })} className="h-14 rounded-[20px] bg-[#f5f5f7] border-none px-6 font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">End Date</label>
                                        <Input type="date" required value={assignForm.deadline} onChange={e => setAssignForm({ ...assignForm, deadline: e.target.value })} className="h-14 rounded-[20px] bg-[#f5f5f7] border-none px-6 font-bold" />
                                    </div>
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

                            <Button type="submit" className="w-full h-16 rounded-[28px] font-black tracking-widest shadow-2xl shadow-[#0051e6]/30 mt-4">DISPATCH TASK</Button>
                        </form>
                    </Card>
                </div>
            )}

            {/* --- TASK DETAILS MODAL --- */}
            {selectedTask && (
                <TaskDetailsModal 
                    task={selectedTask.task}
                    subtasks={selectedTask.subtasks}
                    employees={employees}
                    onClose={() => setSelectedTask(null)}
                    onUpdateStatus={handleUpdateStatusFromModal}
                    onUpdatePriority={handleUpdatePriorityFromModal}
                    onDeleteTask={handleDeleteTask}
                    isEditable={true}
                    currentUserId={userId}
                    isManager={true}
                    refreshData={fetchDashboardData}
                    onAddSubtask={handleAddSubtaskDirect}
                    onDeleteSubtask={handleDeleteSubtaskDirect}
                    activeTimers={activeTimers}
                    onStartTimer={handleStartTimer}
                    onStopTimer={handleStopTimer}
                    orgId={orgId}
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
                                    className="w-full h-40 rounded-3xl bg-[#f5f5f7] border-none p-6 text-sm font-bold resize-none outline-none ring-2 ring-transparent focus:ring-[#0051e6]/20"
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

            {subtaskToDelete && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
                        onClick={cancelDeleteSubtask}
                    />
                    <Card className="relative w-full max-w-[360px] p-8 shadow-[0_32px_64px_rgba(0,0,0,0.3)] border-none bg-white rounded-3xl animate-in zoom-in-95 duration-200">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-14 h-14 bg-[#ff3b30]/10 rounded-2xl flex items-center justify-center mb-6">
                                <Trash2 size={24} color="#ff3b30" strokeWidth={2.5} />
                            </div>
                            
                            <h3 className="text-lg font-black text-[#1d1d1f] tracking-tight mb-2 uppercase tracking-widest text-[11px]">Confirm Delete Work Log</h3>
                            <p className="text-[13px] text-[#86868b] font-medium leading-relaxed mb-8">
                                Permanently delete <span className="text-[#1d1d1f] font-black underline decoration-[#ff3b30]/30">"{subtaskToDelete.subtaskName}"</span>?
                            </p>

                            <div className="grid grid-cols-2 gap-3 w-full">
                                <Button 
                                    variant="secondary" 
                                    className="h-11 rounded-xl font-black text-[10px] uppercase tracking-widest border-[#d2d2d7] hover:bg-[#f5f5f7] text-[#86868b]"
                                    onClick={cancelDeleteSubtask}
                                    disabled={isDeletingSubtask}
                                >
                                    Cancel
                                </Button>
                                <Button 
                                    className="h-11 rounded-xl font-black text-[10px] uppercase tracking-widest bg-[#ff3b30] hover:bg-[#e03126] text-white border-none shadow-lg shadow-[#ff3b30]/20"
                                    onClick={confirmDeleteSubtask}
                                    disabled={isDeletingSubtask}
                                >
                                    {isDeletingSubtask ? 'Deleting...' : 'Delete Log'}
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

            {isRebalancerOpen && (
                <TaskRebalancer 
                    tasks={tasks}
                    employees={employees}
                    memberId={rebalanceMemberId}
                    memberName={rebalanceMemberName}
                    onClose={() => setIsRebalancerOpen(false)}
                    onRebalanceComplete={() => fetchDashboardData(true)}
                />
            )}

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
                                const [subtaskId] = Object.entries(activeTimers)[0];
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

            <VoiceCommandModal 
                isOpen={showVoiceCommand} 
                onClose={() => setShowVoiceCommand(false)} 
                onCommand={handleVoiceCommand}
            />
        </div>
    );
}
