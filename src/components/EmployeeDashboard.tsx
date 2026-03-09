"use client";

import React, { useState, useEffect } from 'react';
import { Task, Profile, Priority, Status, getTasks, getProfiles, saveTask, updateTaskStatus, deleteTask } from '@/app/actions/actions';
import { Card, Button, Input, Select, Badge } from '@/components/ui/components';

export default function EmployeeDashboard({ userId, userName }: { userId: string, userName: string }) {
    const [activeTab, setActiveTab] = useState<'mine' | 'team'>('mine');

    // Data
    const [allTasks, setAllTasks] = useState<Task[]>([]);
    const [myTasks, setMyTasks] = useState<Task[]>([]);
    const [employees, setEmployees] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);

    // Form State
    const [formData, setFormData] = useState<Partial<Task>>({
        name: '',
        start_date: new Date().toISOString().split('T')[0],
        deadline: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        priority: 'Medium',
        hours_spent: 0,
        status: 'To Do',
        notes: ''
    });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        refreshData();
    }, [userId]);

    const refreshData = async () => {
        setLoading(true);
        const [tasks, profiles] = await Promise.all([getTasks(), getProfiles()]);

        setAllTasks(tasks);
        setMyTasks(tasks.filter(t => t.employee_id === userId));
        setEmployees(profiles);
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // 8-hour validation
        const today = new Date().toISOString().split('T')[0];
        const todaysTasks = myTasks.filter(t => t.created_at.startsWith(today));
        const totalHoursToday = todaysTasks.reduce((sum, t) => sum + (Number(t.hours_spent) || 0), 0);

        if (totalHoursToday + Number(formData.hours_spent) > 8) {
            setError(`Warning: This entry exceeds your 8-hour daily limit. You already logged ${totalHoursToday} hours today.`);
            return;
        }

        const newTaskData = {
            ...formData,
            employee_id: userId,
            hours_spent: Number(formData.hours_spent),
            name: formData.name!,
            start_date: formData.start_date!,
            deadline: formData.deadline!,
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
                notes: ''
            }));
        } catch (err: any) {
            setError(err.message || 'Failed to save task.');
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
            <div className="space-y-4 max-h-[750px] overflow-y-auto pr-2 pb-4">
                {tasksList.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(task => (
                    <Card key={task.id} className="p-5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-shadow duration-300 cursor-default border-[#e5e5ea]">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h4 className="font-bold text-lg text-[#1d1d1f]">{task.name}</h4>
                                {showAssignee && (
                                    <div className="text-sm font-medium text-[#0071e3] mt-0.5">Assigned to: {getEmployeeName(task.employee_id)}</div>
                                )}
                            </div>
                            <div className="flex gap-2 items-center">
                                <Badge variant={task.priority}>{task.priority}</Badge>
                                {!showAssignee ? (
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
                                ) : (
                                    <Badge variant={
                                        task.status === 'Completed' ? 'Low' :
                                            task.status === 'Blocked' ? 'Urgent' : 'default'
                                    }>
                                        {task.status}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <div className="text-sm text-[#86868b] mb-4 grid grid-cols-2 gap-2 font-medium">
                            <div>Timeline: <span className="text-[#1d1d1f]">{task.start_date} to {task.deadline}</span></div>
                            <div>Hours Logged: <span className="text-[#0071e3] font-bold">{task.hours_spent}h</span></div>
                        </div>
                        {task.notes && (
                            <div className="text-sm bg-[#f5f5f7] text-[#1d1d1f] p-3 rounded-lg border border-[#e5e5ea]">
                                {task.notes}
                            </div>
                        )}
                    </Card>
                ))}
            </div>
        );
    };

    // Team view data
    const teamTasks = allTasks.filter(t => t.employee_id !== userId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-6 px-2">
                <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-bold tracking-tight text-[#1d1d1f]">Welcome, {userName || 'Employee'}</h2>
                    <div className="text-xs font-bold text-[#86868b] uppercase tracking-widest">Team Management</div>
                </div>

                <div className="flex gap-2 p-1 bg-[#e5e5ea]/50 rounded-xl inline-flex w-fit">
                    <button
                        onClick={() => setActiveTab('mine')}
                        className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'mine' ? 'bg-white shadow-sm text-[#1d1d1f]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                    >
                        My Workspace
                    </button>
                    <button
                        onClick={() => setActiveTab('team')}
                        className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === 'team' ? 'bg-white shadow-sm text-[#0071e3]' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0071e3] opacity-50"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0071e3]"></span>
                        </span>
                        Team Activity
                    </button>
                </div>
            </div>

            {activeTab === 'mine' ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 fade-in">
                    {/* Task Entry Form */}
                    <Card className="lg:col-span-1 border border-[#e5e5ea]">
                        <h3 className="text-xl font-bold mb-6 text-[#1d1d1f]">Log New Activity</h3>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Task Name</label>
                                <Input
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="What are you working on?"
                                    className="w-full"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Start Date</label>
                                    <Input
                                        type="date"
                                        required
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Deadline</label>
                                    <Input
                                        type="date"
                                        required
                                        value={formData.deadline}
                                        onChange={e => setFormData({ ...formData, deadline: e.target.value })}
                                        className="w-full"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Priority</label>
                                    <Select
                                        value={formData.priority}
                                        onChange={e => setFormData({ ...formData, priority: e.target.value as Priority })}
                                        className="w-full"
                                    >
                                        <option>Low</option>
                                        <option>Medium</option>
                                        <option>High</option>
                                        <option>Urgent</option>
                                    </Select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Hours Today</label>
                                    <Input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        max="24"
                                        required
                                        value={formData.hours_spent}
                                        onChange={e => setFormData({ ...formData, hours_spent: Number(e.target.value) })}
                                        className="w-full"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Status</label>
                                <Select
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value as Status })}
                                    className="w-full"
                                >
                                    <option>To Do</option>
                                    <option>In Progress</option>
                                    <option>Blocked</option>
                                    <option>Completed</option>
                                </Select>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-1.5 text-[#1d1d1f]">Notes/Update</label>
                                <textarea
                                    className="w-full bg-white border border-[#d2d2d7] text-[#1d1d1f] rounded-xl px-4 py-3 outline-none transition-all duration-200 focus:border-[#0071e3] focus:ring-1 focus:ring-[#0071e3] placeholder-[#86868b] min-h-[100px]"
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Brief progress summary..."
                                />
                            </div>

                            {error && (
                                <div className="p-4 bg-[#fee2e2] border border-[#f87171] rounded-xl text-[#b91c1c] text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            <Button type="submit" className="w-full mt-2" disabled={loading}>
                                {loading ? 'Saving...' : 'Log Task'}
                            </Button>
                        </form>
                    </Card>

                    {/* Task List */}
                    <div className="lg:col-span-2 space-y-4">
                        <h3 className="text-2xl font-bold mb-6 text-[#1d1d1f] px-2">Your Tracked Tasks</h3>
                        {renderTaskList(myTasks, false)}
                    </div>
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
                    {renderTaskList(teamTasks, true)}
                </div>
            )}
        </div>
    );
}
