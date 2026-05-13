"use server";

import { Task, Profile } from './actions';
import { differenceInDays, parseISO, startOfToday } from 'date-fns';

export interface ROIMetrics {
    projectedLoss: number; // Estimated cost of delays
    velocityScore: number; // 0-100
    teamPredictability: number; // 0-100
    estimatedCompletionDate: string;
}

export async function calculateProjectAnalytics(tasks: Task[], hourlyRate: number = 50): Promise<ROIMetrics> {
    const today = startOfToday();
    
    // 1. Calculate Cost of Delay
    // We assume every day of delay costs the hourly rate * 8 (standard workday)
    const overdueTasks = tasks.filter(t => t.deadline && parseISO(t.deadline) < today && t.status !== 'Completed');
    const totalDaysOverdue = overdueTasks.reduce((acc, t) => {
        return acc + differenceInDays(today, parseISO(t.deadline!));
    }, 0);
    const projectedLoss = totalDaysOverdue * (hourlyRate * 8);

    // 2. Velocity Score
    const completedRecently = tasks.filter(t => t.status === 'Completed').length;
    const velocityScore = Math.min(100, (completedRecently / Math.max(tasks.length, 1)) * 100);

    // 3. Team Predictability
    // Ratio of tasks finished on or before deadline vs tasks finished after or still overdue
    const tasksWithDeadlines = tasks.filter(t => t.deadline);
    const predictableTasks = tasksWithDeadlines.filter(t => {
        if (t.status === 'Completed' && t.updated_at) {
            return parseISO(t.updated_at) <= parseISO(t.deadline!);
        }
        if (t.status !== 'Completed') {
            return parseISO(t.deadline!) >= today;
        }
        return false;
    }).length;
    const teamPredictability = (predictableTasks / Math.max(tasksWithDeadlines.length, 1)) * 100;

    // 4. Estimated Completion
    // Simple linear projection: if we finished X tasks in Y days...
    // For now, we'll return a static projection based on current load
    const remainingTasks = tasks.filter(t => t.status !== 'Completed').length;
    const estDays = Math.ceil(remainingTasks * 1.5); // Assume 1.5 days per remaining task

    return {
        projectedLoss,
        velocityScore,
        teamPredictability,
        estimatedCompletionDate: estDays.toString() // Return days remaining
    };
}
