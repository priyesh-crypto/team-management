"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Task, Subtask, Profile, Priority, Status, getTasks, getProfiles, saveTask, createEmployeeAccount, updateEmployeeProfile, updateUserPassword, updateOwnPassword, updateTaskStatus, deleteTask, getSubtasks, updateProfile, changePassword, updateTask, getNotifications, markNotificationAsRead, markAllNotificationsAsRead, clearNotifications, Notification } from '@/app/actions/actions';
import { Card, Select, Badge, Button, Input } from '@/components/ui/components';
import { TaskDetailsModal } from '@/components/ui/TaskDetailsModal';

export default function ManagerDashboard({ userId, userName }: { userId: string, userName: string }) {
    const [activeTab, setActiveTab] = useState<'board' | 'planning' | 'team' | 'settings'>('board');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTask, setSelectedTask] = useState<{ task: Task, subtasks: Subtask[] } | null>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('week');

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
    const [newEmpForm, setNewEmpForm] = useState({ name: '', email: '', password: '' });
    const [empError, setEmpError] = useState('');
    const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
    const [editEmpForm, setEditEmpForm] = useState({ name: '', role: 'employee', password: '' });
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    // Assign Task State (used in a modal or side panel later maybe, but for now in board)
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [assignForm, setAssignForm] = useState<Partial<Task>>({
        name: '',
        employee_id: '',
        start_date: new Date().toISOString().split('T')[0],
        deadline: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        priority: 'Medium',
        status: 'To Do',
        notes: ''
    });

    useEffect(() => {
        refreshData();
    }, []);

    const refreshData = async () => {
        setLoading(true);
        const [fetchedTasks, fetchedProfiles] = await Promise.all([getTasks(), getProfiles()]);
        setTasks(fetchedTasks);
        setEmployees(fetchedProfiles);
        
        // Fetch all subtasks
        const subtasksPromises = fetchedTasks.map(t => getSubtasks(t.id));
        const subtasksResults = await Promise.all(subtasksPromises);
        const newMap: Record<string, Subtask[]> = {};
        fetchedTasks.forEach((t, i) => {
            newMap[t.id] = subtasksResults[i];
        });
        setSubtasksMap(newMap);
        // Fetch notifications
        const notifs = await getNotifications(userId);
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.is_read).length);
        
        setLoading(false);
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

    const handleCreateEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmpError('');
        try {
            await createEmployeeAccount(newEmpForm.name, newEmpForm.email, newEmpForm.password);
            setNewEmpForm({ name: '', email: '', password: '' });
            refreshData();
        } catch (err: any) {
            setEmpError(err.message || 'Failed to create employee.');
        }
    };

    const handleSaveEdit = async (empId: string) => {
        try {
            await updateEmployeeProfile(empId, editEmpForm.name, editEmpForm.role);
            if (editEmpForm.password) await updateUserPassword(empId, editEmpForm.password);
            setEditingEmpId(null);
            refreshData();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleAssignTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignForm.employee_id || !assignForm.name) return;
        try {
            await saveTask(assignForm as any);
            setShowAssignModal(false);
            setAssignForm({ name: '', employee_id: '', start_date: new Date().toISOString().split('T')[0], deadline: new Date(Date.now() + 86400000).toISOString().split('T')[0], priority: 'Medium', status: 'To Do', notes: '' });
            refreshData();
        } catch (err) {
            alert("Error assigning task");
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
            {/* --- SIDEBAR --- */}
            <div className="w-72 bg-white border-r border-[#e5e5ea] flex flex-col p-6 hidden lg:flex">
                <div className="flex items-center gap-3 mb-10 px-2">
                    <div className="w-10 h-10 bg-[#0071e3] rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-[#0071e3]/20">M</div>
                    <span className="text-xl font-black tracking-tight text-[#1d1d1f]">Manager Hub</span>
                </div>

                <nav className="flex-1 space-y-2">
                    <NavItem icon="📊" label="DASHBOARD" active={activeTab === 'board'} onClick={() => setActiveTab('board')} />
                    <NavItem icon="🗓️" label="PLANNING" active={activeTab === 'planning'} onClick={() => setActiveTab('planning')} />
                    <NavItem icon="👥" label="TEAM MGT" active={activeTab === 'team'} onClick={() => setActiveTab('team')} />
                    <NavItem icon="⚙️" label="SETTINGS" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
                </nav>

                <div className="mt-auto p-4 bg-[#f5f5f7] rounded-[24px] border border-[#e5e5ea]">
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

            {/* --- MAIN CONTENT --- */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#e5e5ea] flex items-center justify-between px-8 sticky top-0 z-10">
                    <div>
                        <div className="flex items-center gap-2 text-[10px] font-black text-[#86868b] uppercase tracking-[0.2em] mb-1">
                            <span>Pages</span>
                            <span>/</span>
                            <span className="text-[#1d1d1f]">{activeTab.toUpperCase()}</span>
                        </div>
                        <h1 className="text-xl font-black text-[#1d1d1f] tracking-tight capitalize">
                            {activeTab === 'board' ? 'Organization Overview' : activeTab === 'planning' ? 'Project Timeline' : activeTab === 'team' ? 'Team Management' : 'My Account'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Input 
                                placeholder="Search tasks..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-64 bg-[#f5f5f7] border-none rounded-2xl h-10 px-10 text-xs font-medium" 
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30">🔍</span>
                        </div>
                        <Button className="rounded-2xl h-10 px-6 font-black text-[10px] tracking-widest shadow-lg shadow-[#0071e3]/20" onClick={() => setShowAssignModal(true)}>+ NEW TASK</Button>
                        <div className="relative">
                            <div 
                                onClick={() => setShowNotifications(!showNotifications)}
                                className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg cursor-pointer transition-colors relative ${showNotifications ? 'bg-[#0071e3] text-white' : 'bg-[#f5f5f7] hover:bg-[#e5e5ea]'}`}
                            >
                                🔔
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#ff3b30] text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white">
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

                <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {activeTab === 'board' && (
                        <div className="flex gap-8">
                            {/* Board View */}
                            <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
                                <div className="grid grid-cols-4 gap-6 min-w-[1200px]">
                                    <BoardColumn title="DRAFT" tasks={tasks.filter(t => t.status === 'To Do' && (t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase())))} employees={employees} onTaskClick={handleTaskClick} />
                                    <BoardColumn title="IN PROGRESS" tasks={tasks.filter(t => t.status === 'In Progress' && (t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase())))} employees={employees} onTaskClick={handleTaskClick} />
                                    <BoardColumn title="EDITING" tasks={tasks.filter(t => t.status === 'Blocked' && (t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase())))} employees={employees} onTaskClick={handleTaskClick} />
                                    <BoardColumn title="DONE" tasks={tasks.filter(t => t.status === 'Completed' && (t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase())))} employees={employees} onTaskClick={handleTaskClick} />
                                </div>
                            </div>

                            {/* Right Stats Panel */}
                            <div className="w-80 space-y-8 flex-shrink-0">
                                <Card className="p-8 pb-10 rounded-[32px] bg-white border-[#eceef0] shadow-sm">
                                    <div className="flex justify-between items-center mb-10">
                                        <h3 className="text-sm font-black text-[#1d1d1f] tracking-widest uppercase">Efficiency</h3>
                                        <Badge variant="secondary" className="bg-[#f0f0f2] text-[#1d1d1f] font-black text-[9px]">2026</Badge>
                                    </div>
                                    
                                    <div className="flex flex-col items-center gap-10">
                                        <div className="relative w-40 h-40">
                                            <svg className="w-full h-full transform -rotate-90">
                                                <circle cx="80" cy="80" r="70" className="stroke-[#f0f0f2] stroke-[12] fill-none" />
                                                <circle 
                                                    cx="80" cy="80" r="70" 
                                                    className="stroke-[#0071e3] stroke-[12] fill-none transition-all duration-1000 ease-out"
                                                    style={{ 
                                                        strokeDasharray: '440',
                                                        strokeDashoffset: 440 - (440 * (boardStats.completed / (boardStats.total || 1)))
                                                    }}
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-3xl font-black text-[#1d1d1f]">{Math.round((boardStats.completed / (boardStats.total || 1)) * 100)}%</span>
                                                <span className="text-[10px] font-black text-[#86868b] uppercase tracking-widest">Completed</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 w-full">
                                            <div className="p-4 bg-[#f5f5f7] rounded-[24px]">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#0071e3]"></div>
                                                    <span className="text-[9px] font-black text-[#86868b] tracking-widest">TOTAL</span>
                                                </div>
                                                <p className="text-xl font-black">{boardStats.total}</p>
                                            </div>
                                            <div className="p-4 bg-[#f5f5f7] rounded-[24px]">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#34c759]"></div>
                                                    <span className="text-[9px] font-black text-[#86868b] tracking-widest">DONE</span>
                                                </div>
                                                <p className="text-xl font-black">{boardStats.completed}</p>
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                <Card className="p-8 pb-10 rounded-[32px] bg-white border-[#eceef0] shadow-sm">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-sm font-black text-[#1d1d1f] tracking-widest uppercase">Priority Heatmap</h3>
                                        <div className="w-2 h-2 rounded-full bg-[#ff3b30] animate-pulse"></div>
                                    </div>
                                    <p className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-6">Critical Active & Overdue</p>
                                    
                                    <div className="space-y-6">
                                        <div className="p-4 bg-[#fff2f2] rounded-2xl border border-[#ff3b30]/10">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-black text-[#ff3b30] uppercase tracking-widest">Overdue</span>
                                                <span className="text-lg font-black text-[#ff3b30]">{heatmapData.overdue.length}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-[#ff3b30]/10 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-[#ff3b30] rounded-full transition-all duration-1000"
                                                    style={{ width: `${Math.min(100, (heatmapData.overdue.length / (heatmapData.active.length + heatmapData.overdue.length || 1)) * 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-[#f5f5f7] rounded-2xl border border-[#e5e5ea]">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-black text-[#1d1d1f] uppercase tracking-widest">Active High/Urgent</span>
                                                <span className="text-lg font-black text-[#1d1d1f]">{heatmapData.active.length}</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-[#e5e5ea] rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-[#1d1d1f] rounded-full transition-all duration-1000"
                                                    style={{ width: `${Math.min(100, (heatmapData.active.length / (heatmapData.active.length + heatmapData.overdue.length || 1)) * 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <div className="pt-2">
                                            <div className="flex flex-col gap-3">
                                                {heatmapData.overdue.slice(0, 5).map(t => (
                                                    <div 
                                                        key={t.id} 
                                                        onClick={() => handleTaskClick(t)}
                                                        className="group cursor-pointer p-3 bg-[#fff2f2]/50 hover:bg-[#fff2f2] rounded-xl border border-[#ff3b30]/10 transition-all"
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-[10px] font-black text-[#ff3b30] uppercase tracking-wider line-clamp-1 flex-1">{t.name}</span>
                                                            <Badge className="bg-[#ff3b30] text-white text-[7px] font-black px-1 rounded ml-2">OVERDUE</Badge>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-4 h-4 rounded-full bg-[#ff3b30]/10 flex items-center justify-center text-[7px] font-bold text-[#ff3b30] uppercase">
                                                                {t.employee?.charAt(0)}
                                                            </div>
                                                            <span className="text-[9px] font-bold text-[#86868b]">{t.employee}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {heatmapData.active.slice(0, 5).map(t => (
                                                    <div 
                                                        key={t.id} 
                                                        onClick={() => handleTaskClick(t)}
                                                        className="group cursor-pointer p-3 bg-[#f5f5f7]/50 hover:bg-[#f5f5f7] rounded-xl border border-[#e5e5ea] transition-all"
                                                    >
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-[10px] font-black text-[#1d1d1f] uppercase tracking-wider line-clamp-1 flex-1">{t.name}</span>
                                                            <Badge className="bg-[#1d1d1f] text-white text-[7px] font-black px-1 rounded ml-2">{t.priority}</Badge>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-4 h-4 rounded-full bg-[#1d1d1f]/10 flex items-center justify-center text-[7px] font-bold text-[#1d1d1f] uppercase">
                                                                {t.employee?.charAt(0)}
                                                            </div>
                                                            <span className="text-[9px] font-bold text-[#86868b]">{t.employee}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {(heatmapData.overdue.length > 5 || heatmapData.active.length > 5) && (
                                                    <p className="text-[9px] font-bold text-center text-[#86868b] mt-2 tracking-widest uppercase">+{heatmapData.overdue.length + heatmapData.active.length - 10} More Critical Tasks</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </div>
                    )}

                    {activeTab === 'planning' && (
                        <div className="space-y-8 bg-white rounded-[40px] p-10 shadow-sm border border-[#eceef0]">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h2 className="text-3xl font-black text-[#1d1d1f] tracking-tight">Timeline</h2>
                                    <p className="text-[#86868b] font-bold text-sm">March 2026 - Sprint Planning</p>
                                </div>
                                <div className="flex gap-3">
                                    <Button 
                                        variant="secondary" 
                                        onClick={() => setViewMode('day')}
                                        className={`rounded-2xl border-[#eceef0] font-black text-[10px] tracking-widest transition-all ${viewMode === 'day' ? 'bg-[#1d1d1f] text-white shadow-lg' : 'hover:bg-[#f5f5f7]'}`}
                                    >
                                        DAY
                                    </Button>
                                    <Button 
                                        variant="secondary" 
                                        onClick={() => setViewMode('week')}
                                        className={`rounded-2xl border-[#eceef0] font-black text-[10px] tracking-widest transition-all ${viewMode === 'week' ? 'bg-[#1d1d1f] text-white shadow-lg' : 'hover:bg-[#f5f5f7]'}`}
                                    >
                                        WEEK
                                    </Button>
                                    <Button 
                                        variant="secondary" 
                                        onClick={() => setViewMode('month')}
                                        className={`rounded-2xl border-[#eceef0] font-black text-[10px] tracking-widest transition-all ${viewMode === 'month' ? 'bg-[#1d1d1f] text-white shadow-lg' : 'hover:bg-[#f5f5f7]'}`}
                                    >
                                        MONTH
                                    </Button>
                                </div>
                            </div>

                            <div className="overflow-x-auto pb-6 relative min-h-[500px]">
                                {/* Timeline Grid */}
                                <div className="min-w-[1200px]">
                                    {/* Date Header */}
                                    <div className="flex mb-10 pl-48">
                                        {timelineData.days.map((date, i) => (
                                            <div key={i} className="flex-1 text-center group">
                                                <div className={`text-[10px] font-black mb-2 transition-colors ${date.toDateString() === new Date().toDateString() ? 'text-[#0071e3]' : 'text-[#86868b]'}`}>
                                                    {date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
                                                </div>
                                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mx-auto transition-all ${date.toDateString() === new Date().toDateString() ? 'bg-[#0071e3] text-white shadow-lg' : 'group-hover:bg-[#f5f5f7] text-[#1d1d1f] font-bold'}`}>
                                                    {date.getDate()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Employee Rows */}
                                    <div className="space-y-6">
                                        {employees.filter(e => e.role === 'employee' && (e.name.toLowerCase().includes(searchQuery.toLowerCase()))).map(emp => (
                                            <div key={emp.id} className="flex group/row">
                                                {/* Employee Info Sticky Column */}
                                                <div className="w-48 pr-8 flex items-center gap-3 sticky left-0 z-[5] bg-white/90 backdrop-blur-sm py-2">
                                                    <div className="w-10 h-10 rounded-2xl bg-[#f5f5f7] flex items-center justify-center text-sm font-black border border-[#e5e5ea] group-hover/row:border-[#0071e3] transition-colors">
                                                        {emp.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className="text-[11px] font-black text-[#1d1d1f] leading-none mb-1">{emp.name}</p>
                                                        <p className="text-[9px] font-bold text-[#86868b] uppercase tracking-widest">{tasks.filter(t => t.employee_id === emp.id).length} TASKS</p>
                                                    </div>
                                                </div>

                                                {/* Tasks Container */}
                                                <div className="flex-1 border-b border-[#f0f0f2] pb-6 relative">
                                                    <div className="absolute inset-0 flex">
                                                        {timelineData.days.map((_, i) => (
                                                            <div key={i} className="flex-1 border-l border-[#f0f0f2]/50 last:border-r"></div>
                                                        ))}
                                                    </div>
                                                    
                                                    <div className="relative pt-4 flex flex-col gap-3 min-h-[40px]">
                                                        {/* Processed tasks for this employee */}
                                                        {(() => {
                                                            const empTasks = tasks.filter(t => t.employee_id === emp.id && (t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase())));
                                                            // Logic for row packing could go here, but let's just render them for now
                                                            return empTasks.map(task => {
                                                                const dayWidth = 100 / timelineData.days.length;
                                                                const start = new Date(task.start_date);
                                                                const end = new Date(task.deadline);
                                                                
                                                                const startIndex = Math.max(0, Math.floor((start.getTime() - timelineData.startDate.getTime()) / (1000 * 60 * 60 * 24)));
                                                                const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                                                                const duration = Math.min(timelineData.days.length - startIndex, totalDays);

                                                                if (startIndex >= timelineData.days.length || duration <= 0) return null;

                                                                return (
                                                                    <div 
                                                                        key={task.id}
                                                                        onClick={() => handleTaskClick(task)}
                                                                        className="h-10 rounded-2xl bg-[#f5f5f7] border border-[#e5e5ea] shadow-sm flex items-center px-4 gap-3 group transition-all hover:bg-[#1d1d1f] hover:text-white hover:z-10 cursor-pointer overflow-hidden"
                                                                        style={{
                                                                            marginLeft: `${startIndex * dayWidth}%`,
                                                                            width: `${duration * dayWidth}%`
                                                                        }}
                                                                    >
                                                                        <div className={`w-2 h-2 rounded-full shrink-0 ${task.status === 'Completed' ? 'bg-[#34c759]' : task.priority === 'Urgent' ? 'bg-[#ff3b30]' : 'bg-[#0071e3]'}`}></div>
                                                                        <span className="text-[10px] font-black truncate">{task.name}</span>
                                                                        <span className="text-[8px] font-bold opacity-0 group-hover:opacity-60 ml-auto whitespace-nowrap">{task.hours_spent} HRS</span>
                                                                    </div>
                                                                );
                                                            });
                                                        })()}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'team' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            <Card className="p-10 rounded-[40px]">
                                <h3 className="text-2xl font-black mb-8 text-[#1d1d1f] tracking-tight">Add New Member</h3>
                                <form onSubmit={handleCreateEmployee} className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Full Name</label>
                                        <Input required value={newEmpForm.name} onChange={e => setNewEmpForm({ ...newEmpForm, name: e.target.value })} placeholder="Jane Cooper" className="h-14 rounded-3xl bg-[#f5f5f7] border-none px-6 text-sm font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Email Address</label>
                                        <Input type="email" required value={newEmpForm.email} onChange={e => setNewEmpForm({ ...newEmpForm, email: e.target.value })} placeholder="jane@apple.com" className="h-14 rounded-3xl bg-[#f5f5f7] border-none px-6 text-sm font-bold" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Password</label>
                                        <Input required value={newEmpForm.password} onChange={e => setNewEmpForm({ ...newEmpForm, password: e.target.value })} placeholder="••••••••" className="h-14 rounded-3xl bg-[#f5f5f7] border-none px-6 text-sm font-bold" />
                                    </div>
                                    {empError && <p className="text-[#ff3b30] text-xs font-bold px-4">{empError}</p>}
                                    <Button type="submit" className="w-full h-14 rounded-3xl font-black tracking-widest text-xs mt-4 shadow-xl shadow-[#0071e3]/20">CREATE MEMBER</Button>
                                </form>
                            </Card>

                            <Card className="p-10 rounded-[40px]">
                                <h3 className="text-2xl font-black mb-8 text-[#1d1d1f] tracking-tight">Active Members</h3>
                                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-4 custom-scrollbar">
                                    {employees.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())).map(emp => (
                                        <div key={emp.id} className="p-6 bg-[#f5f5f7] rounded-[32px] border border-[#e5e5ea] flex items-center justify-between group hover:border-[#0071e3] transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-lg font-black shadow-sm group-hover:bg-[#0071e3] group-hover:text-white transition-all">
                                                    {emp.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-black text-[#1d1d1f]">{emp.name}</p>
                                                        {emp.role === 'manager' && <Badge className="bg-[#0071e3] text-white border-none text-[8px] px-2">ADMIN</Badge>}
                                                    </div>
                                                    <p className="text-[10px] font-mono text-[#86868b]">{emp.id.slice(0, 8)}</p>
                                                </div>
                                            </div>
                                            <Button variant="secondary" onClick={() => setEditingEmpId(emp.id)} className="rounded-[20px] h-10 px-6 font-black text-[9px] tracking-widest border-none bg-white hover:bg-white shadow-sm">EDIT</Button>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="max-w-4xl mx-auto space-y-10">
                            <div className="flex items-center gap-8 mb-16">
                                <div className="w-32 h-32 bg-gradient-to-br from-[#0071e3] to-[#00c6ff] rounded-[48px] flex items-center justify-center text-white text-5xl font-black shadow-2xl shadow-[#0071e3]/30">
                                    {userName.charAt(0)}
                                </div>
                                <div>
                                    <h2 className="text-5xl font-black text-[#1d1d1f] tracking-tighter mb-2">{userName}</h2>
                                    <p className="text-xl font-bold text-[#86868b] tracking-tight">Executive Management Account</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <Card className="p-10 rounded-[40px]">
                                    <h3 className="text-xl font-black mb-10 text-[#1d1d1f] flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-xl bg-[#f5f5f7] flex items-center justify-center text-sm">👤</span>
                                        Profile Details
                                    </h3>
                                    <form onSubmit={handleUpdateProfile} className="space-y-8">
                                        <div className="space-y-4">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-[#86868b] ml-4">Full Name</label>
                                            <Input value={profileName} onChange={e => setProfileName(e.target.value)} className="h-16 rounded-[24px] bg-[#f5f5f7] border-none px-8 text-lg font-bold" />
                                        </div>
                                        <Button type="submit" disabled={isUpdatingProfile} className="w-full h-16 rounded-[24px] font-black tracking-widest shadow-xl shadow-[#0071e3]/20">
                                            {isUpdatingProfile ? 'UPDATING...' : 'SAVE CHANGES'}
                                        </Button>
                                    </form>
                                </Card>

                                <Card className="p-10 rounded-[40px]">
                                    <h3 className="text-xl font-black mb-10 text-[#1d1d1f] flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-xl bg-[#f5f5f7] flex items-center justify-center text-sm">🔒</span>
                                        Security
                                    </h3>
                                    <form onSubmit={handleChangePassword} className="space-y-6">
                                        <div className="space-y-4">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-[#86868b] ml-4">New Password</label>
                                            <Input type="password" value={passwords.new} onChange={e => setPasswords({ ...passwords, new: e.target.value })} className="h-16 rounded-[24px] bg-[#f5f5f7] border-none px-8 text-lg font-bold" placeholder="••••••••" />
                                        </div>
                                        <div className="space-y-4">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-[#86868b] ml-4">Confirm Password</label>
                                            <Input type="password" value={passwords.confirm} onChange={e => setPasswords({ ...passwords, confirm: e.target.value })} className="h-16 rounded-[24px] bg-[#f5f5f7] border-none px-8 text-lg font-bold" placeholder="••••••••" />
                                        </div>
                                        <Button type="submit" disabled={isUpdatingPassword} variant="secondary" className="w-full h-16 rounded-[24px] font-black tracking-widest border-[#e5e5ea] hover:bg-[#f5f5f7]">
                                            {isUpdatingPassword ? 'UPDATING...' : 'CHANGE PASSWORD'}
                                        </Button>
                                    </form>
                                </Card>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* --- ASSIGN TASK MODAL --- */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
                    <Card className="w-full max-w-xl p-10 rounded-[48px] bg-white shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-10">
                            <h2 className="text-3xl font-black text-[#1d1d1f] tracking-tight">Create New Task</h2>
                            <button onClick={() => setShowAssignModal(false)} className="w-10 h-10 rounded-full bg-[#f5f5f7] flex items-center justify-center font-bold hover:bg-[#e5e5ea]">✕</button>
                        </div>

                        <form onSubmit={handleAssignTask} className="space-y-8">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Assign To</label>
                                    <Select required value={assignForm.employee_id} onChange={e => setAssignForm({ ...assignForm, employee_id: e.target.value })} className="h-14 rounded-[20px] bg-[#f5f5f7] border-none px-6 font-bold">
                                        <option value="">Select teammate</option>
                                        {employees.filter(e => e.role === 'employee').map(emp => (
                                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                                        ))}
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[#86868b] ml-4">Task Objective</label>
                                    <Input required value={assignForm.name} onChange={e => setAssignForm({ ...assignForm, name: e.target.value })} placeholder="What needs to be done?" className="h-14 rounded-[20px] bg-[#f5f5f7] border-none px-6 font-bold" />
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
                    isEditable={true}
                    currentUserId={userId}
                    refreshData={refreshData}
                />
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

function BoardColumn({ title, tasks, employees, onTaskClick }: { title: string, tasks: Task[], employees: Profile[], onTaskClick: (task: Task) => void }) {
    return (
        <div className="space-y-8 flex flex-col h-full">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black text-[#1d1d1f] tracking-[0.2em] uppercase">{title}</h3>
                <span className="w-5 h-5 rounded-full bg-[#f0f0f2] flex items-center justify-center text-[10px] font-black text-[#86868b]">{tasks.length}</span>
            </div>
            <div className="space-y-4 flex-1">
                {tasks.length === 0 ? (
                    <div className="h-32 border-2 border-dashed border-[#e5e5ea] rounded-[32px] flex items-center justify-center">
                        <span className="text-[8px] font-black text-[#d2d2d7] uppercase tracking-widest">No Items</span>
                    </div>
                ) : (
                    tasks.map(task => (
                        <div 
                            key={task.id} 
                            onClick={() => onTaskClick(task)}
                            className="bg-white p-6 rounded-[32px] shadow-sm border border-[#eceef0] hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 group cursor-pointer relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-[#f0f0f2] group-hover:bg-[#0071e3] transition-colors"></div>
                            <div className="flex justify-between items-start mb-6">
                                <h4 className="text-xs font-black text-[#1d1d1f] leading-relaxed pr-4">{task.name || 'Main Project'}</h4>
                                <div className={`w-2 h-2 rounded-full shrink-0 ${task.priority === 'Urgent' ? 'bg-[#ff3b30]' : task.priority === 'High' ? 'bg-[#ff9500]' : 'bg-[#0071e3]'}`}></div>
                            </div>
                            
                            <div className="flex items-center justify-between mt-auto pt-6 border-t border-[#f0f0f2]">
                                <div className="flex -space-x-2">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#1d1d1f] to-[#434343] border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-sm">
                                        {employees.find(e => e.id === task.employee_id)?.name?.charAt(0) || '?'}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-[9px] font-black text-[#d2d2d7]">
                                    <span className="group-hover:text-[#1d1d1f] transition-colors">💬 0</span>
                                    <span className="group-hover:text-[#1d1d1f] transition-colors">📎 0</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
