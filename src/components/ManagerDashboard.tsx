"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Task, Profile, Priority, Status, getTasks, getProfiles, saveTask, createEmployeeAccount, updateEmployeeProfile, updateUserPassword, updateOwnPassword, updateTaskStatus, deleteTask } from '@/app/actions/actions';
import { Card, Select, Badge, Button, Input } from '@/components/ui/components';

export default function ManagerDashboard({ userId, userName }: { userId: string, userName: string }) {
    const [activeTab, setActiveTab] = useState<'overview' | 'progress' | 'team' | 'assign' | 'settings'>('overview');

    // Data State
    const [tasks, setTasks] = useState<Task[]>([]);
    const [employees, setEmployees] = useState<Profile[]>([]);
    const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>('all');
    const [selectedProgressUser, setSelectedProgressUser] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // New Employee Form State
    const [newEmpForm, setNewEmpForm] = useState({ name: '', email: '', password: '' });
    const [empError, setEmpError] = useState('');

    // Edit Employee State
    const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
    const [editEmpForm, setEditEmpForm] = useState({ name: '', role: 'employee', password: '' });

    // Self Settings Form State
    const [selfPasswordForm, setSelfPasswordForm] = useState('');
    const [settingsSuccess, setSettingsSuccess] = useState(false);

    // Assign Task Form State
    const [assignForm, setAssignForm] = useState<Partial<Task>>({
        name: '',
        employee_id: '',
        start_date: new Date().toISOString().split('T')[0],
        deadline: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        priority: 'Medium',
        hours_spent: 0,
        status: 'To Do',
        notes: 'Assigned by Manager.'
    });
    const [assignSuccess, setAssignSuccess] = useState(false);

    useEffect(() => {
        refreshData();
    }, []);

    const refreshData = async () => {
        setLoading(true);
        const [fetchedTasks, fetchedProfiles] = await Promise.all([getTasks(), getProfiles()]);
        setTasks(fetchedTasks);
        // Managers can see everyone.
        setEmployees(fetchedProfiles);
        setLoading(false);
    };

    // ---- Overview Logic ----
    const filteredTasks = useMemo(() => {
        if (selectedEmployeeFilter === 'all') return tasks;
        return tasks.filter(t => t.employee_id === selectedEmployeeFilter);
    }, [tasks, selectedEmployeeFilter]);

    const capacityData = useMemo(() => {
        const data: Record<string, number> = {};
        filteredTasks.forEach(task => {
            const empName = employees.find(e => e.id === task.employee_id)?.name || 'Unknown';
            data[empName] = (data[empName] || 0) + Number(task.hours_spent);
        });
        return Object.entries(data).map(([name, hours]) => ({ name, hours }));
    }, [filteredTasks, employees]);

    const summaryStats = useMemo(() => {
        const total = filteredTasks.length;
        if (total === 0) return { completed: 0, inProgress: 0, blocked: 0 };

        const completed = filteredTasks.filter(t => t.status === 'Completed').length;
        const blocked = filteredTasks.filter(t => t.status === 'Blocked').length;

        return {
            completed: Math.round((completed / total) * 100),
            blocked: Math.round((blocked / total) * 100),
            inProgress: Math.round(((total - completed - blocked) / total) * 100)
        };
    }, [filteredTasks]);

    const isOverdue = (deadline: string) => {
        return new Date(deadline) < new Date(new Date().toISOString().split('T')[0]);
    };

    // ---- Individual Progress Logic ----
    const progressTasks = useMemo(() => {
        return tasks.filter(t => t.employee_id === selectedProgressUser).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [tasks, selectedProgressUser]);

    const progressStats = useMemo(() => {
        const total = progressTasks.length;
        const completed = progressTasks.filter(t => t.status === 'Completed').length;
        const totalHours = progressTasks.reduce((sum, t) => sum + Number(t.hours_spent), 0);
        const completionRate = total === 0 ? 0 : Math.round((completed / total) * 100);
        return { total, completed, totalHours, completionRate };
    }, [progressTasks]);

    // ---- Team Management Handlers ----
    const handleCreateEmployee = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmpError('');

        try {
            await createEmployeeAccount(newEmpForm.name, newEmpForm.email, newEmpForm.password);
            setNewEmpForm({ name: '', email: '', password: '' });
            refreshData();
        } catch (err: any) {
            setEmpError(err.message || 'Failed to create employee profile.');
        }
    };

    const handleStartEdit = (emp: Profile) => {
        setEditingEmpId(emp.id);
        setEditEmpForm({ name: emp.name, role: emp.role, password: '' });
    };

    const handleCancelEdit = () => {
        setEditingEmpId(null);
        setEditEmpForm({ name: '', role: 'employee', password: '' });
    };

    const handleSaveEdit = async (empId: string) => {
        try {
            await updateEmployeeProfile(empId, editEmpForm.name, editEmpForm.role);

            if (editEmpForm.password.trim() !== '') {
                await updateUserPassword(empId, editEmpForm.password);
            }

            setEditingEmpId(null);
            refreshData();
        } catch (err: any) {
            alert(err.message || "Failed to update profile.");
        }
    };

    const handleSelfPasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSettingsSuccess(false);

        try {
            await updateOwnPassword(selfPasswordForm);
            setSelfPasswordForm('');
            setSettingsSuccess(true);
            setTimeout(() => setSettingsSuccess(false), 3000);
        } catch (err: any) {
            alert(err.message || "Failed to update password.");
        }
    };

    // ---- Assign Task Handler ----
    const handleAssignTask = async (e: React.FormEvent) => {
        e.preventDefault();
        setAssignSuccess(false);

        if (!assignForm.employee_id) {
            alert("Please select an employee.");
            return;
        }

        const newTaskData = {
            ...assignForm,
            hours_spent: 0,
            name: assignForm.name!,
            employee_id: assignForm.employee_id!,
            start_date: assignForm.start_date!,
            deadline: assignForm.deadline!,
            priority: assignForm.priority as Priority,
            status: assignForm.status as Status,
            notes: assignForm.notes || ''
        };

        try {
            await saveTask(newTaskData);
            setAssignSuccess(true);
            refreshData();

            setAssignForm({
                ...assignForm,
                name: '',
                notes: 'Assigned by Manager.'
            });

            setTimeout(() => setAssignSuccess(false), 3000);
        } catch (err) {
            alert("Error assigning task.");
        }
    };

    if (loading) {
        return <div className="text-center py-20 font-bold text-[#86868b] animate-pulse">Loading Manager Access...</div>;
    }

    return (
        <div className="space-y-8">
            {/* Header and Tabs */}
            <div className="flex flex-col gap-6 px-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">Master View</h2>
                    <div className="text-xs font-bold text-[#86868b] uppercase tracking-widest mt-1">Team Management ({userName || 'Admin'})</div>
                </div>

                <div className="flex gap-2 p-1 bg-[#e5e5ea]/50 rounded-xl inline-flex w-fit max-w-full overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                    >
                        Analytics Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('progress')}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'progress' ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                    >
                        Employee Progress
                    </button>
                    <button
                        onClick={() => setActiveTab('team')}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'team' ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                    >
                        Team Management
                    </button>
                    <button
                        onClick={() => setActiveTab('assign')}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'assign' ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                    >
                        Assign Tasks
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${activeTab === 'settings' ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                    >
                        My Settings
                    </button>
                </div>
            </div>

            {/* --- OVERVIEW TAB --- */}
            {activeTab === 'overview' && (
                <div className="space-y-8 fade-in">
                    <div className="flex justify-end px-2">
                        <div className="w-full md:w-64">
                            <label className="block text-xs font-semibold mb-1 text-[#86868b] uppercase tracking-wider">Filter Employee</label>
                            <Select
                                value={selectedEmployeeFilter}
                                onChange={e => setSelectedEmployeeFilter(e.target.value)}
                                className="w-full py-2"
                            >
                                <option value="all">All Employees</option>
                                {employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Weekly Summary Widget */}
                        <Card className="col-span-1 md:col-span-2 lg:col-span-2 bg-[#f0f9ff] border-[#bae6fd]">
                            <h3 className="text-xl font-bold mb-6 text-[#1d1d1f]">Weekly Summary</h3>
                            <div className="flex gap-6 items-center">
                                <div className="w-28 h-28 rounded-full border-8 border-white bg-white shadow-sm relative flex items-center justify-center">
                                    <span className="text-3xl font-bold text-[#0071e3]">{summaryStats.completed}%</span>
                                </div>
                                <div className="space-y-3 flex-1 font-medium">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-[#16a34a]">Completed</span>
                                        <span className="text-[#1d1d1f]">{summaryStats.completed}%</span>
                                    </div>
                                    <div className="w-full bg-[#e0f2fe] h-2.5 rounded-full overflow-hidden">
                                        <div className="bg-[#34c759] h-full rounded-full" style={{ width: `${summaryStats.completed}%` }}></div>
                                    </div>

                                    <div className="flex justify-between text-sm mt-3">
                                        <span className="text-[#0071e3]">In Progress / To Do</span>
                                        <span className="text-[#1d1d1f]">{summaryStats.inProgress}%</span>
                                    </div>
                                    <div className="w-full bg-[#e0f2fe] h-2.5 rounded-full overflow-hidden">
                                        <div className="bg-[#0071e3] h-full rounded-full" style={{ width: `${summaryStats.inProgress}%` }}></div>
                                    </div>

                                    {summaryStats.blocked > 0 && (
                                        <>
                                            <div className="flex justify-between text-sm mt-3">
                                                <span className="text-[#e83f3f]">Blocked</span>
                                                <span className="text-[#1d1d1f]">{summaryStats.blocked}%</span>
                                            </div>
                                            <div className="w-full bg-[#e0f2fe] h-2.5 rounded-full overflow-hidden">
                                                <div className="bg-[#e83f3f] h-full rounded-full" style={{ width: `${summaryStats.blocked}%` }}></div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </Card>

                        {/* Total Capacity Tracker */}
                        <Card className="col-span-1 md:col-span-2 lg:col-span-2">
                            <h3 className="text-xl font-bold mb-6 text-[#1d1d1f]">Total Capacity Tracker</h3>
                            <div className="space-y-3 max-h-[140px] overflow-y-auto pr-2">
                                {capacityData.length === 0 ? <span className="text-[#86868b] font-medium">No data</span> : null}
                                {capacityData.map((data, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea]">
                                        <span className="font-semibold text-[#1d1d1f]">{data.name}</span>
                                        <span className="px-3 py-1 bg-white text-[#0071e3] shadow-sm rounded-lg font-bold text-sm">
                                            {data.hours} hrs
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Priority Heatmap */}
                        <Card className="max-h-[500px] overflow-y-auto">
                            <h3 className="text-xl font-bold mb-2 text-[#1d1d1f] flex items-center gap-2">
                                <span className="text-[#e83f3f]">●</span> Priority Heatmap
                            </h3>
                            <p className="text-sm font-medium text-[#86868b] mb-6">Showing High & Urgent tasks that are active or overdue.</p>

                            <div className="space-y-4 pr-2">
                                {filteredTasks
                                    .filter(t => ['Urgent', 'High'].includes(t.priority) && t.status !== 'Completed')
                                    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
                                    .map(task => {
                                        const overdue = isOverdue(task.deadline);
                                        const empName = employees.find(e => e.id === task.employee_id)?.name;

                                        return (
                                            <div
                                                key={task.id}
                                                className={`p-4 rounded-2xl border flex flex-col gap-3 ${overdue ? 'bg-[#fff1f2] border-[#fecdd3]' :
                                                    task.priority === 'Urgent' ? 'bg-[#fff7ed] border-[#ffedd5]' :
                                                        'bg-[#f5f5f7] border-[#e5e5ea]'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <div className="font-bold text-[#1d1d1f]">{task.name}</div>
                                                    {overdue ? (
                                                        <span className="text-xs bg-[#e83f3f] text-white px-2.5 py-1 rounded-full font-bold uppercase tracking-wider animate-pulse shadow-sm">Overdue</span>
                                                    ) : (
                                                        <Badge variant={task.priority}>{task.priority}</Badge>
                                                    )}
                                                </div>
                                                <div className="text-sm font-medium text-[#86868b] grid grid-cols-2">
                                                    <div>Assignee: <span className="text-[#1d1d1f]">{empName}</span></div>
                                                    <div className={overdue ? 'text-[#e83f3f] font-bold' : ''}>Deadline: {task.deadline}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                {filteredTasks.filter(t => ['Urgent', 'High'].includes(t.priority) && t.status !== 'Completed').length === 0 && (
                                    <div className="text-[#86868b] font-medium py-4 text-center">No active high-priority tasks.</div>
                                )}
                            </div>
                        </Card>

                        {/* Project Timeline (Gantt Style) */}
                        <Card className="overflow-hidden flex flex-col">
                            <h3 className="text-xl font-bold mb-6 text-[#1d1d1f]">Project Timeline</h3>
                            <div className="flex-1 overflow-x-auto overflow-y-auto pb-4 custom-scrollbar relative min-h-[400px]">
                                {filteredTasks.length === 0 ? (
                                    <div className="text-[#86868b] font-medium">No tasks to timeline.</div>
                                ) : (
                                    <div className="min-w-[700px] space-y-4 pt-4">
                                        {(() => {
                                            const timestamps = filteredTasks.flatMap(t => [new Date(t.start_date).getTime(), new Date(t.deadline).getTime()]);
                                            const minDate = Math.min(...timestamps);
                                            const maxDate = Math.max(...timestamps);
                                            const totalDuration = Math.max(86400000, maxDate - minDate);

                                            return filteredTasks.map(task => {
                                                const startOffset = ((new Date(task.start_date).getTime() - minDate) / totalDuration) * 100;
                                                const durationPct = Math.max(5, ((new Date(task.deadline).getTime() - new Date(task.start_date).getTime()) / totalDuration) * 100);
                                                const empName = employees.find(e => e.id === task.employee_id)?.name;

                                                return (
                                                    <div key={task.id} className="relative h-10 group">
                                                        <div className="absolute w-full h-full bg-[#f5f5f7] rounded-xl overflow-hidden">
                                                            <div
                                                                className={`absolute h-full rounded-xl flex items-center px-4 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-300 group-hover:brightness-95
                                  ${task.status === 'Completed' ? 'bg-[#34c759] text-white' :
                                                                        task.status === 'Blocked' ? 'bg-[#e83f3f] text-white' :
                                                                            'bg-[#0071e3] text-white'}`
                                                                }
                                                                style={{
                                                                    left: `${startOffset}%`,
                                                                    width: `${durationPct}%`,
                                                                    minWidth: '60px'
                                                                }}
                                                                title={`${task.name} (${task.start_date} to ${task.deadline})`}
                                                            >
                                                                <span className="text-sm font-semibold truncate">
                                                                    {task.name}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="absolute -top-6 left-0 text-xs font-semibold text-[#86868b] opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 py-1 rounded shadow-sm border border-[#e5e5ea] z-10">
                                                            {empName} • {task.status}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}

                                <div className="absolute inset-x-0 bottom-0 h-8 border-t border-[#e5e5ea] flex justify-between text-xs font-semibold text-[#86868b] px-4 pt-2 pointer-events-none">
                                    <span>Start</span>
                                    <span>Horizon</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* --- EMPLOYEE PROGRESS TAB --- */}
            {activeTab === 'progress' && (
                <div className="space-y-6 fade-in max-w-5xl mx-auto">
                    <Card className="bg-[#f5f5f7] border-[#e5e5ea]">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-[#1d1d1f]">Individual Performance Review</h3>
                                <p className="text-[#86868b] text-sm mt-1">Select an employee to deeply review their logged tasks, hours, and daily notes.</p>
                            </div>
                            <div className="w-full md:w-72">
                                <Select
                                    value={selectedProgressUser}
                                    onChange={e => setSelectedProgressUser(e.target.value)}
                                    className="w-full py-2 border-[#d2d2d7]"
                                >
                                    <option value="" disabled>Select Employee</option>
                                    {employees.filter(e => e.role === 'employee').map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                                    ))}
                                </Select>
                            </div>
                        </div>
                    </Card>

                    {selectedProgressUser ? (
                        <div className="space-y-6 fade-in">
                            {/* Individual Stats Row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <Card className="text-center py-6">
                                    <div className="text-sm font-semibold text-[#86868b] uppercase tracking-wider mb-2">Completion Rate</div>
                                    <div className="text-4xl font-bold text-[#0071e3]">{progressStats.completionRate}%</div>
                                </Card>
                                <Card className="text-center py-6">
                                    <div className="text-sm font-semibold text-[#86868b] uppercase tracking-wider mb-2">Total Tasks Assigned</div>
                                    <div className="text-4xl font-bold text-[#1d1d1f]">{progressStats.total}</div>
                                </Card>
                                <Card className="text-center py-6">
                                    <div className="text-sm font-semibold text-[#86868b] uppercase tracking-wider mb-2">Total Hours Logged</div>
                                    <div className="text-4xl font-bold text-[#16a34a]">{progressStats.totalHours}h</div>
                                </Card>
                            </div>

                            {/* Detailed Task List */}
                            <Card>
                                <h3 className="text-xl font-bold mb-6 text-[#1d1d1f]">Detailed Task History</h3>
                                <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
                                    {progressTasks.length === 0 ? (
                                        <div className="text-center py-10 text-[#86868b] font-medium">This employee currently has no tasks logged.</div>
                                    ) : (
                                        progressTasks.map(task => (
                                            <div key={task.id} className="p-5 border border-[#e5e5ea] rounded-2xl bg-[#fafafa] hover:bg-white transition-colors">
                                                <div className="flex justify-between items-start mb-3">
                                                    <h4 className="font-bold text-lg text-[#1d1d1f]">{task.name}</h4>
                                                    <div className="flex gap-2 items-center">
                                                        <Badge variant={task.priority}>{task.priority}</Badge>
                                                        <div className="flex gap-2 items-center">
                                                            <Select
                                                                value={task.status}
                                                                onChange={async (e) => {
                                                                    try {
                                                                        await updateTaskStatus(task.id, e.target.value as Status);
                                                                        refreshData();
                                                                    } catch (err) {
                                                                        alert("Failed to update status.");
                                                                    }
                                                                }}
                                                                className="text-xs py-1 px-2 h-auto"
                                                            >
                                                                <option>To Do</option>
                                                                <option>In Progress</option>
                                                                <option>Blocked</option>
                                                                <option>Completed</option>
                                                            </Select>
                                                            <button
                                                                onClick={async () => {
                                                                    if (confirm("Are you sure you want to delete this task?")) {
                                                                        try {
                                                                            await deleteTask(task.id);
                                                                            refreshData();
                                                                        } catch (err) {
                                                                            alert("Failed to delete task.");
                                                                        }
                                                                    }
                                                                }}
                                                                className="text-[#86868b] hover:text-[#e83f3f] transition-colors p-1"
                                                                title="Delete Task"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-[#86868b] font-medium mb-4">
                                                    <div>Timeline: <span className="text-[#1d1d1f]">{task.start_date} <br />to {task.deadline}</span></div>
                                                    <div>Hours Logged: <span className="text-[#0071e3] font-bold text-lg block">{task.hours_spent}h</span></div>
                                                    <div>Created On: <span className="text-[#1d1d1f] block">{new Date(task.created_at).toLocaleDateString()}</span></div>
                                                </div>
                                                {task.notes && (
                                                    <div className="mt-2 text-sm bg-white text-[#1d1d1f] p-3 rounded-lg border border-[#e5e5ea] shadow-sm">
                                                        <span className="text-xs font-bold text-[#86868b] uppercase tracking-wider mb-1 block">Employee Notes:</span>
                                                        {task.notes}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </Card>
                        </div>
                    ) : (
                        <div className="text-center py-20 fade-in">
                            <div className="text-6xl mb-4">👀</div>
                            <h3 className="text-xl font-bold text-[#1d1d1f] mb-2">No Employee Selected</h3>
                            <p className="text-[#86868b]">Please use the dropdown above to select a team member to review their progress.</p>
                        </div>
                    )}
                </div>
            )}

            {/* --- TEAM MANAGEMENT TAB --- */}
            {activeTab === 'team' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in">
                    <Card>
                        <h3 className="text-xl font-bold mb-6 text-[#1d1d1f]">Add New Employee</h3>
                        <form onSubmit={handleCreateEmployee} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Full Name</label>
                                <Input
                                    required
                                    value={newEmpForm.name}
                                    onChange={e => setNewEmpForm({ ...newEmpForm, name: e.target.value })}
                                    placeholder="e.g. Jane Doe"
                                    className="w-full"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Email Address</label>
                                <Input
                                    type="email"
                                    required
                                    value={newEmpForm.email}
                                    onChange={e => setNewEmpForm({ ...newEmpForm, email: e.target.value })}
                                    placeholder="jane@company.com"
                                    className="w-full"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Temporary Password</label>
                                <Input
                                    type="text"
                                    required
                                    value={newEmpForm.password}
                                    onChange={e => setNewEmpForm({ ...newEmpForm, password: e.target.value })}
                                    placeholder="Set an initial password"
                                    className="w-full"
                                />
                            </div>

                            {empError && (
                                <div className="p-4 bg-[#fef2f2] border border-[#fca5a5] rounded-xl text-[#b91c1c] text-sm font-bold">
                                    {empError}
                                </div>
                            )}

                            <Button type="submit" className="w-full mt-2">Create Account</Button>
                        </form>
                    </Card>

                    <Card>
                        <h3 className="text-xl font-bold mb-6 text-[#1d1d1f]">Active Organization Members</h3>
                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                            {employees.length === 0 ? (
                                <div className="text-[#86868b] text-center py-8 font-medium">No employees found.</div>
                            ) : (
                                employees.map(emp => (
                                    <div key={emp.id} className="p-4 border border-[#e5e5ea] rounded-2xl bg-[#f5f5f7]">
                                        {editingEmpId === emp.id ? (
                                            <div className="space-y-3">
                                                <Input
                                                    value={editEmpForm.name}
                                                    onChange={(e) => setEditEmpForm({ ...editEmpForm, name: e.target.value })}
                                                    className="w-full text-sm py-1.5"
                                                    placeholder="Display Name"
                                                />
                                                <Select
                                                    value={editEmpForm.role}
                                                    onChange={(e) => setEditEmpForm({ ...editEmpForm, role: e.target.value })}
                                                    className="w-full text-sm py-1.5"
                                                >
                                                    <option value="employee">Employee</option>
                                                    <option value="manager">Manager</option>
                                                </Select>
                                                <Input
                                                    type="text"
                                                    value={editEmpForm.password}
                                                    onChange={(e) => setEditEmpForm({ ...editEmpForm, password: e.target.value })}
                                                    className="w-full text-sm py-1.5"
                                                    placeholder="Reset password (leave blank to keep current)"
                                                />
                                                <div className="flex justify-end gap-2 pt-2">
                                                    <Button variant="secondary" onClick={handleCancelEdit} className="text-xs px-3 py-1.5">Cancel</Button>
                                                    <Button onClick={() => handleSaveEdit(emp.id)} className="text-xs px-3 py-1.5">Save Changes</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <div className="font-bold text-[#1d1d1f] flex items-center gap-2">
                                                        {emp.name}
                                                        {emp.role === 'manager' && <span className="text-[10px] bg-[#0071e3] text-white px-1.5 py-0.5 rounded-full uppercase font-bold">Admin</span>}
                                                    </div>
                                                    <div className="text-xs text-[#86868b] font-mono mt-0.5">ID: {emp.id.substring(0, 8)}...</div>
                                                </div>
                                                <Button
                                                    variant="secondary"
                                                    onClick={() => handleStartEdit(emp)}
                                                    className="text-xs px-3 py-1.5"
                                                >
                                                    Edit Profile
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            )}

            {/* --- ASSIGN TASKS TAB --- */}
            {activeTab === 'assign' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-in">
                    <Card>
                        <h3 className="text-xl font-bold mb-6 text-[#1d1d1f]">Assign a Task</h3>
                        <form onSubmit={handleAssignTask} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Assign To</label>
                                <Select
                                    required
                                    value={assignForm.employee_id}
                                    onChange={e => setAssignForm({ ...assignForm, employee_id: e.target.value })}
                                    className="w-full"
                                >
                                    <option value="" disabled>Select Employee</option>
                                    {employees.filter(e => e.role === 'employee').map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                                    ))}
                                </Select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Task Name</label>
                                <Input
                                    required
                                    value={assignForm.name}
                                    onChange={e => setAssignForm({ ...assignForm, name: e.target.value })}
                                    placeholder="Task title"
                                    className="w-full"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Start Date</label>
                                    <Input
                                        type="date"
                                        required
                                        value={assignForm.start_date}
                                        onChange={e => setAssignForm({ ...assignForm, start_date: e.target.value })}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Deadline</label>
                                    <Input
                                        type="date"
                                        required
                                        value={assignForm.deadline}
                                        onChange={e => setAssignForm({ ...assignForm, deadline: e.target.value })}
                                        className="w-full"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Priority</label>
                                    <Select
                                        value={assignForm.priority}
                                        onChange={e => setAssignForm({ ...assignForm, priority: e.target.value as Priority })}
                                        className="w-full"
                                    >
                                        <option>Low</option>
                                        <option>Medium</option>
                                        <option>High</option>
                                        <option>Urgent</option>
                                    </Select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Initial Status</label>
                                    <Select
                                        value={assignForm.status}
                                        onChange={e => setAssignForm({ ...assignForm, status: e.target.value as Status })}
                                        className="w-full"
                                    >
                                        <option>To Do</option>
                                        <option>In Progress</option>
                                        <option>Blocked</option>
                                        <option>Completed</option>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Manager Notes / Instructions</label>
                                <textarea
                                    className="w-full bg-white border border-[#d2d2d7] text-[#1d1d1f] rounded-xl px-4 py-3 outline-none transition-all duration-200 focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3] placeholder-[#86868b] min-h-[100px]"
                                    value={assignForm.notes}
                                    onChange={e => setAssignForm({ ...assignForm, notes: e.target.value })}
                                    placeholder="Instructions for the employee..."
                                />
                            </div>

                            {assignSuccess && (
                                <div className="p-4 bg-[#dcfce7] border border-[#4ade80] rounded-xl text-[#16a34a] text-sm font-medium">
                                    Task successfully assigned to database!
                                </div>
                            )}

                            <Button type="submit" className="w-full mt-2">Send Assignment</Button>
                        </form>
                    </Card>

                    <div className="space-y-4">
                        <h3 className="text-xl font-bold text-[#1d1d1f] px-2">Manager Instructions</h3>
                        <Card className="bg-[#f5f5f7] border-0">
                            <p className="text-[#86868b] text-sm leading-relaxed">
                                Use this form to assign new trackable objectives to your team members. Tasks assigned here will immediately appear in the employee's "My Tasks" view and on the broader "Team View" board and persist in our live database.
                                <br /><br />
                                Employees will be responsible for logging their daily hours on these tasks to keep the capacity tracker up to date.
                            </p>
                        </Card>
                    </div>
                </div>
            )}

            {/* --- MY SETTINGS TAB --- */}
            {activeTab === 'settings' && (
                <div className="max-w-2xl fade-in">
                    <Card>
                        <h3 className="text-xl font-bold mb-2 text-[#1d1d1f]">Account Security</h3>
                        <p className="text-[#86868b] text-sm mb-6">Update the password for your Manager account ({userName}).</p>
                        <form onSubmit={handleSelfPasswordUpdate} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">New Password</label>
                                <Input
                                    type="password"
                                    required
                                    value={selfPasswordForm}
                                    onChange={e => setSelfPasswordForm(e.target.value)}
                                    placeholder="Enter a new secure password"
                                    className="w-full"
                                />
                            </div>

                            {settingsSuccess && (
                                <div className="p-4 bg-[#dcfce7] border border-[#4ade80] rounded-xl text-[#16a34a] text-sm font-medium">
                                    Your password has been securely updated!
                                </div>
                            )}

                            <Button type="submit">Update My Password</Button>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
}
