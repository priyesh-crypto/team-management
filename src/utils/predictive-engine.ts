import { Task, Subtask } from "@/app/actions/actions";

export type PredictionLevel = 'On Track' | 'At Risk' | 'Delayed' | 'Overdue';

export interface TaskPrediction {
    level: PredictionLevel;
    confidence: number;
    reason?: string;
    predictedDelayDays?: number;
}

export function predictTaskStatus(task: Task, subtasks: Subtask[]): TaskPrediction {
    const now = new Date();
    const start = new Date(task.start_date || task.created_at);
    const deadline = new Date(task.deadline);
    
    if (task.status === 'Completed') return { level: 'On Track', confidence: 100 };
    
    // Check if already overdue
    if (deadline < now) {
        const delayDays = Math.ceil((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
        return { 
            level: 'Overdue', 
            confidence: 100, 
            reason: `Past deadline by ${delayDays} day${delayDays > 1 ? 's' : ''}`,
            predictedDelayDays: delayDays
        };
    }

    const totalDuration = deadline.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    
    if (totalDuration <= 0) return { level: 'On Track', confidence: 50 };
    
    const timeRatio = Math.max(0, Math.min(1, elapsed / totalDuration));
    
    // Progress calculation
    let progressRatio = 0;
    if (subtasks.length > 0) {
        const completed = subtasks.filter(s => s.is_completed).length;
        progressRatio = completed / subtasks.length;
    } else {
        // Fallback progress based on status if no subtasks
        const statusProgress: Record<string, number> = {
            'To Do': 0.1,
            'In Progress': 0.4,
            'In Review': 0.8,
            'Blocked': 0.2
        };
        progressRatio = statusProgress[task.status] || 0;
    }

    // Velocity check
    const velocityLag = timeRatio - progressRatio;
    
    if (velocityLag > 0.3) {
        return { 
            level: 'Delayed', 
            confidence: 85, 
            reason: 'Significant velocity lag detected relative to deadline.',
            predictedDelayDays: Math.ceil((velocityLag * totalDuration) / (1000 * 60 * 60 * 24))
        };
    } else if (velocityLag > 0.15) {
        return { 
            level: 'At Risk', 
            confidence: 70, 
            reason: 'Slight progress lag. Needs attention to stay on schedule.',
            predictedDelayDays: Math.ceil((velocityLag * totalDuration) / (1000 * 60 * 60 * 24))
        };
    }

    return { level: 'On Track', confidence: 90 };
}
