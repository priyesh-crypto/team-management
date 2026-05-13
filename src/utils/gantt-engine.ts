import { Task } from "@/app/actions/actions";

interface GanttTask extends Task {
    depends_on?: string[];
}

export function autoSprint(tasks: GanttTask[], changedTaskId: string, newStartDate: Date, newDeadline: Date): GanttTask[] {
    const updatedTasks = [...tasks];
    const taskIndex = updatedTasks.findIndex(t => t.id === changedTaskId);
    if (taskIndex === -1) return tasks;

    const task = updatedTasks[taskIndex];
    const oldDeadline = new Date(task.deadline).getTime();
    const newDeadlineTime = newDeadline.getTime();
    
    // Only shift if the deadline moved forward
    if (newDeadlineTime <= oldDeadline) {
        updatedTasks[taskIndex] = { ...task, start_date: newStartDate.toISOString(), deadline: newDeadline.toISOString() };
        return updatedTasks;
    }

    const shiftMs = newDeadlineTime - oldDeadline;
    updatedTasks[taskIndex] = { ...task, start_date: newStartDate.toISOString(), deadline: newDeadline.toISOString() };

    // Recursive shift for dependents
    const shiftDependents = (parentId: string) => {
        updatedTasks.forEach((t, i) => {
            if (t.depends_on?.includes(parentId)) {
                const currentStart = new Date(t.start_date || t.created_at);
                const currentEnd = new Date(t.deadline);
                
                // If parent deadline now overlaps with child start, shift child
                if (newDeadlineTime > currentStart.getTime()) {
                    const newStart = new Date(currentStart.getTime() + shiftMs);
                    const newEnd = new Date(currentEnd.getTime() + shiftMs);
                    updatedTasks[i] = { ...t, start_date: newStart.toISOString(), deadline: newEnd.toISOString() };
                    shiftDependents(t.id);
                }
            }
        });
    };

    shiftDependents(changedTaskId);
    return updatedTasks;
}
