// Pure server-side computation helpers for the reports dashboard

export type RawTask = {
    id: string;
    name: string;
    status: string;
    priority: string;
    deadline: string | null;
    created_at: string;
    start_date: string | null;
    employee_id: string | null;
    hours_spent: number | null;
    workspace_id: string | null;
    project_id: string | null;
};

export type MemberRow = {
    user_id: string;
    role: string;
    profiles: { name: string } | null;
};

export type ProjectRow = {
    id: string;
    name: string;
    color: string;
};

export type WorkspaceRow = {
    id: string;
    name: string;
};

export type ActivityRow = {
    type: string;
    created_at: string;
};

export function filterByRange(tasks: RawTask[], rangeDays: number): RawTask[] {
    const cutoff = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
    return tasks.filter(t => t.created_at >= cutoff);
}

export function computeStats(
    tasks: RawTask[],
    memberCount: number,
    workspaceCount: number,
    projectCount: number
) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "Completed").length;
    const overdue = tasks.filter(
        t => t.deadline && new Date(t.deadline) < new Date() && t.status !== "Completed"
    ).length;
    const totalHours = tasks.reduce((s, t) => s + (Number(t.hours_spent) || 0), 0);
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const completedWithStart = tasks.filter(t => t.status === "Completed" && t.start_date);
    const avgCycleDays =
        completedWithStart.length > 0
            ? Math.round(
                  completedWithStart.reduce((s, t) => {
                      return (
                          s +
                          (Date.now() - new Date(t.start_date!).getTime()) /
                              (1000 * 60 * 60 * 24)
                      );
                  }, 0) / completedWithStart.length
              )
            : 0;

    return {
        total,
        completed,
        overdue,
        totalHours: Math.round(totalHours),
        memberCount,
        workspaceCount,
        projectCount,
        completionRate,
        avgCycleDays,
    };
}

export function computeSparklines(tasks: RawTask[], periods = 4) {
    return Array.from({ length: periods }, (_, i) => {
        const end = new Date();
        end.setDate(end.getDate() - i * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 7);
        const s = start.toISOString();
        const e = end.toISOString();
        const pt = tasks.filter(t => t.created_at >= s && t.created_at < e);
        return {
            created: pt.length,
            completed: pt.filter(t => t.status === "Completed").length,
            overdue: pt.filter(
                t => t.deadline && new Date(t.deadline) < end && t.status !== "Completed"
            ).length,
            hours: Math.round(pt.reduce((s, t) => s + (Number(t.hours_spent) || 0), 0)),
        };
    }).reverse();
}

export function computeWeeklyTrend(tasks: RawTask[], weeks = 8) {
    return Array.from({ length: weeks }, (_, i) => {
        const end = new Date();
        end.setDate(end.getDate() - i * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 7);
        const s = start.toISOString();
        const e = end.toISOString();
        return {
            label: i === 0 ? "This Wk" : i === 1 ? "Last Wk" : `W-${i}`,
            weekStart: s.split("T")[0],
            created: tasks.filter(t => t.created_at >= s && t.created_at < e).length,
            completed: tasks.filter(
                t => t.status === "Completed" && t.created_at >= s && t.created_at < e
            ).length,
        };
    }).reverse();
}

export function computeCycleTimeBuckets(tasks: RawTask[]) {
    const buckets = [
        { label: "< 1d", min: 0, max: 1, count: 0 },
        { label: "1–3d", min: 1, max: 3, count: 0 },
        { label: "3–7d", min: 3, max: 7, count: 0 },
        { label: "7–14d", min: 7, max: 14, count: 0 },
        { label: "14–30d", min: 14, max: 30, count: 0 },
        { label: "30+d", min: 30, max: Infinity, count: 0 },
    ];
    // Use start_date when available, fall back to created_at
    tasks
        .filter(t => t.status === "Completed")
        .forEach(t => {
            const refDate = t.start_date ?? t.created_at;
            const days = (Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24);
            const b = buckets.find(b => days >= b.min && days < b.max);
            if (b) b.count++;
        });
    return buckets.map(({ label, count }) => ({ label, count }));
}

export function computeAgingBuckets(tasks: RawTask[]) {
    const active = tasks.filter(t => t.status !== "Completed");
    const now = Date.now();
    return [
        { label: "< 7d", min: 0, max: 7, color: "#22be66" },
        { label: "7–14d", min: 7, max: 14, color: "#0051e6" },
        { label: "14–30d", min: 14, max: 30, color: "#f5a623" },
        { label: "30+d", min: 30, max: Infinity, color: "#ff3b30" },
    ].map(b => ({
        label: b.label,
        color: b.color,
        count: active.filter(t => {
            const days = (now - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24);
            return days >= b.min && days < b.max;
        }).length,
    }));
}

export function computeFunnel(tasks: RawTask[]) {
    const COLORS: Record<string, string> = {
        "To Do": "#86868b",
        "In Progress": "#0051e6",
        "In Review": "#5e5ce6",
        Completed: "#22be66",
    };
    return ["To Do", "In Progress", "In Review", "Completed"].map(s => ({
        name: s,
        value: tasks.filter(t => t.status === s).length,
        fill: COLORS[s],
    }));
}

export function computePriorityStatusMatrix(tasks: RawTask[]) {
    const priorities = ["Urgent", "High", "Medium", "Low"];
    const statuses = ["To Do", "In Progress", "In Review", "Blocked", "Completed"];
    return priorities.flatMap(priority =>
        statuses.map(status => ({
            priority,
            status,
            count: tasks.filter(t => t.priority === priority && t.status === status).length,
        }))
    );
}

export function computeExtendedHeatmap(tasks: RawTask[], days = 84) {
    return Array.from({ length: days }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        const dateStr = d.toISOString().split("T")[0];
        return {
            date: dateStr,
            count: tasks.filter(t => t.created_at.startsWith(dateStr)).length,
        };
    });
}

export function computeActivityByType(logs: ActivityRow[]) {
    const LABELS: Record<string, string> = {
        task_created: "Task Created",
        task_updated: "Task Updated",
        task_deleted: "Task Deleted",
        task_status_changed: "Status Changed",
        task_priority_changed: "Priority Changed",
        comment_added: "Comment Added",
        subtask_created: "Subtask Created",
        subtask_completed: "Subtask Done",
        member_invited: "Member Invited",
        member_joined: "Member Joined",
        attachment_added: "File Uploaded",
    };
    const counts: Record<string, number> = {};
    logs.forEach(l => {
        counts[l.type] = (counts[l.type] || 0) + 1;
    });
    return Object.entries(counts)
        .map(([type, count]) => ({ type, label: LABELS[type] || type, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
}

export function computeOverdueList(tasks: RawTask[], members: MemberRow[]) {
    const memberMap = new Map(
        members.map(m => [
            m.user_id,
            m.profiles?.name || m.user_id.slice(0, 6) + "...",
        ])
    );
    const now = new Date();
    return tasks
        .filter(t => t.deadline && new Date(t.deadline) < now && t.status !== "Completed")
        .map(t => ({
            id: t.id,
            name: t.name,
            priority: t.priority,
            daysOverdue: Math.round(
                (now.getTime() - new Date(t.deadline!).getTime()) / (1000 * 60 * 60 * 24)
            ),
            assignee: memberMap.get(t.employee_id || "") || "Unassigned",
            status: t.status,
        }))
        .sort((a, b) => b.daysOverdue - a.daysOverdue)
        .slice(0, 15);
}

export function computeByMember(tasks: RawTask[], members: MemberRow[]) {
    const now = new Date();
    return members
        .map(m => {
            const mt = tasks.filter(t => t.employee_id === m.user_id);
            const completed = mt.filter(t => t.status === "Completed").length;
            const overdue = mt.filter(
                t =>
                    t.deadline &&
                    new Date(t.deadline) < now &&
                    t.status !== "Completed"
            ).length;
            const hours = mt.reduce((s, t) => s + (Number(t.hours_spent) || 0), 0);
            return {
                user_id: m.user_id,
                name: m.profiles?.name || m.user_id.slice(0, 6) + "...",
                role: m.role,
                total: mt.length,
                completed,
                overdue,
                hours: Math.round(hours),
                completionRate: mt.length > 0 ? Math.round((completed / mt.length) * 100) : 0,
            };
        })
        .sort((a, b) => b.total - a.total);
}

export function computeByProject(tasks: RawTask[], projects: ProjectRow[]) {
    const now = new Date();
    return projects
        .map(p => {
            const pt = tasks.filter(t => t.project_id === p.id);
            const completed = pt.filter(t => t.status === "Completed").length;
            const overdue = pt.filter(
                t =>
                    t.deadline &&
                    new Date(t.deadline) < now &&
                    t.status !== "Completed"
            ).length;
            return {
                id: p.id,
                name: p.name,
                color: p.color || "#0051e6",
                total: pt.length,
                completed,
                overdue,
                completionRate:
                    pt.length > 0 ? Math.round((completed / pt.length) * 100) : 0,
            };
        })
        .filter(p => p.total > 0)
        .sort((a, b) => b.total - a.total);
}

export function computeByWorkspace(tasks: RawTask[], workspaces: WorkspaceRow[]) {
    return workspaces
        .map(w => ({
            id: w.id,
            name: w.name,
            total: tasks.filter(t => t.workspace_id === w.id).length,
            completed: tasks.filter(
                t => t.workspace_id === w.id && t.status === "Completed"
            ).length,
        }))
        .filter(w => w.total > 0)
        .sort((a, b) => b.total - a.total);
}

export function computeMemberEfficiency(tasks: RawTask[], members: MemberRow[]) {
    return members
        .map(m => {
            const mt = tasks.filter(t => t.employee_id === m.user_id);
            const completed = mt.filter(t => t.status === "Completed").length;
            const hours = Math.round(
                mt.reduce((s, t) => s + (Number(t.hours_spent) || 0), 0)
            );
            return {
                name: m.profiles?.name || m.user_id.slice(0, 6) + "...",
                tasks: completed,
                hours,
                completionRate:
                    mt.length > 0 ? Math.round((completed / mt.length) * 100) : 0,
            };
        })
        .filter(m => m.tasks > 0 || m.hours > 0);
}
