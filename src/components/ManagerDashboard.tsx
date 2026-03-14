"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Task, Subtask, Profile, Priority, Status, getTasks, getProfiles, saveTask, inviteMember, updateEmployeeProfile, updateUserPassword, updateOwnPassword, updateTaskStatus, deleteTask, getSubtasks, getBulkSubtasks, updateProfile, changePassword, updateTask, getNotifications, markNotificationAsRead, markAllNotificationsAsRead, clearNotifications, Notification, deleteEmployee, sendAlert } from '@/app/actions/actions';
import { Card, Select, Badge, Button, Input } from '@/components/ui/components';
import { TaskDetailsModal } from '@/components/ui/TaskDetailsModal';
import TimelineSchedule from '@/components/ui/TimelineSchedule';
import { Pencil, Trash2, Menu, X, Calendar } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function ManagerDashboard({ userId, userName }: { userId: string, userName: string }) {
    const [activeTab, setActiveTab] = useState<'board' | 'planning' | 'team' | 'settings'>('board');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTask, setSelectedTask] = useState<{ task: Task, subtasks: Subtask[] } | null>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Data State
    const [tasks, setTasks] = useState<Task[]>([]); // This will hold all tasks
    const [employees, setEmployees] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [subtasksMap, setSubtasksMap] = useState<Record<string, Subtask[]>>({});

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
    const [showTaskDeleteConfirm, setShowTaskDeleteConfirm] = useState(false);
    const [taskToDelete, setTaskToDelete] = useState<{ id: string, name: string } | null>(null);

    // Assign Task State (used in a modal or side panel later maybe, but for now in board)
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignForm, setAssignForm] = useState<Partial<Task>>({
        name: '',
        employee_id: '',
        assignee_ids: [],
        start_date: new Date().toISOString().split('T')[0],
        deadline: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        priority: 'Medium',
        status: 'To Do',
        notes: ''
    });

    useEffect(() => {
        refreshData();

        // Initialize Supabase client for real-time
        const supabase = createClient();
        
        // Subscribe to tasks, subtasks, profiles, and notifications
        const taskChannel = supabase
            .channel('manager-dashboard-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => refreshData(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'subtasks' }, () => refreshData(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => refreshData(true))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => refreshData(true))
            .subscribe();

        return () => {
            supabase.removeChannel(taskChannel);
        };
    }, []);

    const refreshData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [fetchedTasks, fetchedProfiles] = await Promise.all([getTasks(), getProfiles()]);
            setTasks(fetchedTasks);
            setEmployees(fetchedProfiles);
            
            // Fetch all subtasks in bulk for better performance
            const taskIds = fetchedTasks.map(t => t.id);
            const allSubtasks = await getBulkSubtasks(taskIds);
            
            const newMap: Record<string, Subtask[]> = {};
            allSubtasks.forEach(st => {
                if (!newMap[st.task_id]) newMap[st.task_id] = [];
                newMap[st.task_id].push(st);
            });
            setSubtasksMap(newMap);

            // Fetch notifications
            const notifs = await getNotifications(userId);
            setNotifications(notifs);
            setUnreadCount(notifs.filter(n => !n.is_read).length);
        } catch (error) {
            console.error("Error refreshing dashboard data:", error);
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


    const handleTaskClick = async (task: Task) => {
        const subtasks = await getSubtasks(task.id);
        setSelectedTask({ task, subtasks });
    };

    const handleUpdateStatusFromModal = async (taskId: string, status: Status) => {
        setIsUpdatingStatus(true);
        try {
            await updateTaskStatus(taskId, status);
            await refreshData(); // Refresh all data to get updated tasks and subtasks
            
            // Update selected task in modal if it's the same one
            if (selectedTask && selectedTask.task.id === taskId) {
                const updatedTask = tasks.find(t => t.id === taskId); // Find from the refreshed tasks
                if (updatedTask) {
                    const subtasks = await getSubtasks(taskId); // Re-fetch subtasks for the updated task
                    setSelectedTask({ task: updatedTask, subtasks: subtasks });
                }
            }
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

        const groupTasksByStatus = (status: Status) => filteredTasks.filter(t => t.status === status);

        const total = filteredTasks.length;
        const completed = groupTasksByStatus('Completed').length;
        const inProgress = groupTasksByStatus('In Progress').length;
        const draft = groupTasksByStatus('To Do').length;

        return { total, completed, inProgress, draft };
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
                            <NavItem icon="🗓️" label="PLANNING" active={activeTab === 'planning'} onClick={() => { setActiveTab('planning'); setIsMobileMenuOpen(false); }} />
                            <NavItem icon="👥" label="TEAM MGT" active={activeTab === 'team'} onClick={() => { setActiveTab('team'); setIsMobileMenuOpen(false); }} />
                            <NavItem icon="⚙️" label="SETTINGS" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} />
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
                    <NavItem icon="🗓️" label="PLANNING" active={activeTab === 'planning'} onClick={() => setActiveTab('planning')} />
                    <NavItem icon="👥" label="TEAM MGT" active={activeTab === 'team'} onClick={() => setActiveTab('team')} />
                    <NavItem icon="⚙️" label="SETTINGS" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
                </nav>

                <div className="mt-auto p-4 bg-[#f5f5f7] rounded-2xl border border-[#e5e5ea]">
                    <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-[10px] font-bold border border-[#d2d2d7]">
                            {userName.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold truncate leading-tight">{userName}</p>
                            <p className="text-[9px] text-[#86868b] font-medium uppercase tracking-tighter">Admin</p>
                        </div>
                    </div>
                    <button onClick={() => window.location.href = '/'} className="w-full py-1.5 text-[10px] font-black uppercase tracking-widest text-[#86868b] hover:text-[#1d1d1f] transition-colors border border-[#d2d2d7] rounded-lg bg-white/50">
                        Logout
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
                        <div>
                            <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#86868b] uppercase tracking-wider mb-0.5">
                                <span className="hidden sm:inline">Portal</span>
                                <span className="hidden sm:inline opacity-30">/</span>
                                <span className="text-[#000]">{activeTab.toUpperCase()}</span>
                            </div>
                            <h1 className="text-sm font-black text-[#1d1d1f] tracking-tight truncate max-w-[150px] sm:max-w-none">
                                {activeTab === 'board' ? 'Organization Overview' : activeTab === 'planning' ? 'Project Timeline' : activeTab === 'team' ? 'Team Management' : 'My Account'}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group hidden sm:block">
                            <input 
                                placeholder="Search everything..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-48 lg:w-56 bg-[#f5f5f7] border-none rounded-lg h-8 px-8 text-[11px] font-medium placeholder:text-[#86868b] focus:ring-1 ring-[#0071e3] transition-all" 
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] opacity-40">🔍</span>
                        </div>
                        <button className="rounded-lg h-8 px-3 bg-[#0071e3] text-white font-bold text-[10px] tracking-tight shadow-sm hover:bg-[#005bb7] transition-colors" onClick={() => setShowAssignModal(true)}>
                            + NEW TASK
                        </button>
                        <div className="relative">
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 min-w-full sm:min-w-[800px] xl:min-w-none">
                                    <BoardColumn title="TO DO" tasks={tasks.filter(t => t.status === 'To Do' && (t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase())))} employees={employees} onTaskClick={handleTaskClick} onDeleteTask={handleDeleteTask} />
                                    <BoardColumn title="IN PROGRESS" tasks={tasks.filter(t => t.status === 'In Progress' && (t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase())))} employees={employees} onTaskClick={handleTaskClick} onDeleteTask={handleDeleteTask} />
                                    <BoardColumn title="BLOCKED" tasks={tasks.filter(t => t.status === 'Blocked' && (t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase())))} employees={employees} onTaskClick={handleTaskClick} onDeleteTask={handleDeleteTask} />
                                    <BoardColumn title="COMPLETED" tasks={tasks.filter(t => t.status === 'Completed' && (t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase())))} employees={employees} onTaskClick={handleTaskClick} onDeleteTask={handleDeleteTask} />
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
                        <div className="h-[calc(100vh-180px)] min-h-[600px]">
                            <TimelineSchedule 
                                tasks={tasks} 
                                employees={employees} 
                                onTaskClick={handleTaskClick}
                                refreshData={refreshData}
                            />
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
                                <h3 className="text-base font-black mb-4 text-[#1d1d1f] tracking-tight">Active Members</h3>
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                    {employees.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())).map(emp => (
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

                            <div className="grid grid-cols-1 gap-6">
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
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Primary Owner</label>
                                        <Select required value={assignForm.employee_id} onChange={e => setAssignForm({ ...assignForm, employee_id: e.target.value })} className="h-14 rounded-[20px] bg-[#f5f5f7] border-none px-6 font-bold">
                                            <option value="">Select owner</option>
                                            {employees.filter(e => e.role === 'employee').map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                                            ))}
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Additional Collaborators</label>
                                        <div className="flex flex-wrap gap-2 p-4 bg-[#f5f5f7] rounded-[24px]">
                                            {employees.filter(e => e.role === 'employee' && e.id !== assignForm.employee_id).map(emp => {
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
        </div>
    );
}

// --- Helper Components ---

function NavItem({ icon, label, active = false, onClick }: { icon: string, label: string, active?: boolean, onClick?: () => void }) {
    return (
        <button 
            onClick={onClick}
            className={`w-full flex items-center gap-4 px-4 py-4 rounded-3xl transition-all duration-300 group ${active ? 'bg-[#0071e3] shadow-xl shadow-[#0071e3]/20 text-white' : 'hover:bg-[#f5f5f7] text-[#86868b]'}`}
        >
            <span className={`text-xl ${active ? '' : 'filter grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100'}`}>{icon}</span>
            <span className={`text-[10px] font-black tracking-[0.2em] ${active ? 'text-white' : 'group-hover:text-[#1d1d1f]'}`}>{label}</span>
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
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const taskDate = new Date(date);
    taskDate.setHours(0, 0, 0, 0);

    if (taskDate.getTime() === today.getTime()) return { label: 'TODAY', color: 'bg-[#ff3b30]/10 text-[#ff3b30]' };
    if (taskDate.getTime() === tomorrow.getTime()) return { label: 'TOMORROW', color: 'bg-[#ff9500]/10 text-[#ff9500]' };
    if (taskDate.getTime() === yesterday.getTime()) return { label: 'YESTERDAY', color: 'bg-[#86868b]/10 text-[#86868b]' };

    return { 
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase(), 
        color: 'bg-[#f5f5f7] text-[#86868b]' 
    };
};

function BoardColumn({ title, tasks, employees, onTaskClick, onDeleteTask }: { title: string, tasks: Task[], employees: Profile[], onTaskClick: (task: Task) => void, onDeleteTask: (taskId: string, taskName: string) => void }) {
    return (
        <div className="space-y-4 flex flex-col h-full">
            <div className="flex items-center justify-between px-1">
                <h3 className="text-[9px] font-black text-[#86868b] tracking-widest uppercase">{title}</h3>
                <span className="w-4 h-4 rounded-md bg-[#f0f0f2] flex items-center justify-center text-[9px] font-black text-[#1d1d1f]">{tasks.length}</span>
            </div>
            <div className="space-y-3 flex-1">
                {tasks.length === 0 ? (
                    <div className="h-24 border-2 border-dashed border-[#e5e5ea] rounded-2xl flex items-center justify-center bg-white/30">
                        <span className="text-[8px] font-black text-[#d2d2d7] uppercase tracking-widest">Empty</span>
                    </div>
                ) : (
                    tasks.map(task => {
                        const dateInfo = formatTaskDate(task.deadline);
                        return (
                            <div 
                                key={task.id} 
                                onClick={() => onTaskClick(task)}
                                className="bg-white p-4 rounded-2xl shadow-sm border border-[#eceef0] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group cursor-pointer relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-0.5 h-full bg-[#f0f0f2] group-hover:bg-[#0071e3] transition-colors"></div>
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1 pr-4">
                                        <h4 className="text-[11px] font-bold text-[#1d1d1f] leading-snug mb-1.5">{task.name || 'Untitled Task'}</h4>
                                        {dateInfo && (
                                            <div className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[7px] font-black tracking-widest ${dateInfo.color}`}>
                                                {dateInfo.label}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className={`w-1.5 h-1.5 rounded-full ${task.priority === 'Urgent' ? 'bg-[#ff3b30]' : task.priority === 'High' ? 'bg-[#ff9500]' : 'bg-[#0071e3]'}`}></div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteTask(task.id, task.name);
                                            }}
                                            className="p-1 hover:bg-[#ff3b30]/10 text-[#86868b] hover:text-[#ff3b30] rounded transition-all opacity-0 group-hover:opacity-100"
                                            title="Delete Task"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between mt-auto pt-3 border-t border-[#f5f5f7]">
                                    <div className="flex -space-x-1.5 overflow-hidden">
                                        {[task.employee_id, ...(task.assignee_ids || [])].slice(0, 3).map((id, idx) => {
                                            const emp = employees.find(e => e.id === id);
                                            if (!emp) return null;
                                            return (
                                                <div key={`${task.id}-assignee-${id}`} className="w-6 h-6 rounded-full bg-white border border-[#e5e5ea] flex items-center justify-center text-[9px] font-bold text-[#1d1d1f] shadow-sm shrink-0" title={emp.name}>
                                                    {emp.name?.charAt(0) || '?'}
                                                </div>
                                            );
                                        })}
                                        {[task.employee_id, ...(task.assignee_ids || [])].length > 3 && (
                                            <div className="w-6 h-6 rounded-full bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center text-[8px] font-black text-[#86868b] shrink-0">
                                                +{[task.employee_id, ...(task.assignee_ids || [])].length - 3}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-[8px] font-bold text-[#d2d2d7]">
                                        <span className="flex items-center gap-1 group-hover:text-[#1d1d1f] transition-colors">💬 0</span>
                                        <span className="flex items-center gap-1 group-hover:text-[#1d1d1f] transition-colors">📎 0</span>
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
