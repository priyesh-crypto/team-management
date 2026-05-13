"use server";

import { createClient } from '@/utils/supabase/server';
import { Task, Profile } from './actions';
import { format, subDays, startOfToday, parseISO } from 'date-fns';

export interface BriefingSection {
    type: 'alert' | 'success' | 'info' | 'bottleneck';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    metadata?: any;
}

export interface MorningBriefing {
    summary: string;
    sections: BriefingSection[];
    date: string;
}

export async function generateMorningBriefingAction(userId: string): Promise<MorningBriefing> {
    const supabase = await createClient();
    
    // 1. Fetch all relevant data
    const { data: tasks } = await supabase.from('tasks').select('*') as { data: Task[] };
    const { data: employees } = await supabase.from('employees').select('*') as { data: Profile[] };
    
    if (!tasks || !employees) throw new Error("Could not fetch data for briefing");

    const sections: BriefingSection[] = [];
    const today = startOfToday();
    const yesterday = subDays(today, 1);

    // --- ALERTS: Overdue & Burnout ---
    const overdueCount = tasks.filter(t => t.deadline && parseISO(t.deadline) < today && t.status !== 'Completed').length;
    if (overdueCount > 0) {
        sections.push({
            type: 'alert',
            title: `${overdueCount} Overdue Tasks`,
            description: `There are ${overdueCount} tasks that missed their deadlines. This is currently the primary bottleneck.`,
            priority: 'high'
        });
    }

    // Burnout Check
    employees.forEach(emp => {
        const activeTasks = tasks.filter(t => t.employee_id === emp.id && t.status !== 'Completed');
        const urgentCount = activeTasks.filter(t => t.priority === 'Urgent').length;
        if (activeTasks.length > 5 || urgentCount > 2) {
            sections.push({
                type: 'bottleneck',
                title: `${emp.name} is at Overload Risk`,
                description: `${emp.name} has ${activeTasks.length} active tasks. Consider rebalancing to prevent burnout.`,
                priority: 'medium',
                metadata: { employeeId: emp.id }
            });
        }
    });

    // --- SUCCESS: Completed Yesterday ---
    const completedYesterday = tasks.filter(t => t.status === 'Completed' && t.updated_at && parseISO(t.updated_at) >= yesterday).length;
    if (completedYesterday > 0) {
        sections.push({
            type: 'success',
            title: `Solid Progress`,
            description: `The team successfully cleared ${completedYesterday} tasks in the last 24 hours.`,
            priority: 'low'
        });
    }

    // --- BOTTLENECKS: Dependency Chain ---
    const blockedTasks = tasks.filter(t => t.status === 'Blocked');
    blockedTasks.forEach(bt => {
        sections.push({
            type: 'bottleneck',
            title: `Blocker Detected: ${bt.name}`,
            description: `This task is marked as Blocked. Review the dependency chain in the Gantt Chart.`,
            priority: 'high',
            metadata: { taskId: bt.id }
        });
    });

    // Generate a high-level summary
    const summary = overdueCount > 3 
        ? "Today requires immediate attention on overdue items." 
        : completedYesterday > 2 
            ? "Team velocity is high. A good day to focus on long-term planning." 
            : "Stable day ahead. Focus on unassigned items in the Smart Queue.";

    return {
        summary,
        sections,
        date: format(today, 'MMMM do, yyyy')
    };
}
