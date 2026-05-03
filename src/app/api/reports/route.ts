import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
    filterByRange,
    computeStats,
    computeSparklines,
    computeWeeklyTrend,
    computeCycleTimeBuckets,
    computeAgingBuckets,
    computeFunnel,
    computePriorityStatusMatrix,
    computeExtendedHeatmap,
    computeActivityByType,
    computeOverdueList,
    computeByMember,
    computeByProject,
    computeByWorkspace,
    computeMemberEfficiency,
} from "@/lib/reports";

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
        .from("organization_members")
        .select("org_id")
        .eq("user_id", user.id)
        .maybeSingle();
    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const range = Math.min(365, Math.max(7, Number(req.nextUrl.searchParams.get("range")) || 30));
    const orgId = membership.org_id;

    const [tasksRes, membersRes, workspacesRes, projectsRes, activityRes] = await Promise.all([
        supabase
            .from("tasks")
            .select("id, name, status, priority, deadline, created_at, start_date, employee_id, hours_spent, workspace_id, project_id")
            .eq("org_id", orgId),
        supabase.from("organization_members").select("user_id, role, profiles(name)").eq("org_id", orgId),
        supabase.from("workspaces").select("id, name").eq("org_id", orgId),
        supabase.from("projects").select("id, name, color").eq("org_id", orgId),
        supabase
            .from("activity_logs")
            .select("type, created_at")
            .eq("org_id", orgId)
            .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const allTasks = (tasksRes.data ?? []) as any[];
    const members = (membersRes.data ?? []) as any[];
    const workspaces = (workspacesRes.data ?? []) as any[];
    const projects = (projectsRes.data ?? []) as any[];
    const activityLogs = (activityRes.data ?? []) as any[];

    const tasks = filterByRange(allTasks, range);

    const byStatus = ["To Do", "In Progress", "In Review", "Blocked", "Completed"].map(s => ({
        status: s,
        count: tasks.filter((t: any) => t.status === s).length,
    }));

    const byPriority = ["Urgent", "High", "Medium", "Low"].map(p => ({
        priority: p,
        count: tasks.filter((t: any) => t.priority === p).length,
    }));

    const baseStats = computeStats(tasks, members.length, workspaces.length, projects.length);
    const sparklines = computeSparklines(allTasks, 4);

    return NextResponse.json({
        range,
        stats: { ...baseStats, sparklines },
        byStatus,
        byPriority,
        byMember: computeByMember(tasks, members),
        byProject: computeByProject(tasks, projects),
        byWorkspace: computeByWorkspace(tasks, workspaces),
        weeklyTrend: computeWeeklyTrend(allTasks, 8),
        dailyActivity: computeExtendedHeatmap(allTasks, 84),
        cycleTimeBuckets: computeCycleTimeBuckets(tasks),
        agingBuckets: computeAgingBuckets(tasks),
        funnelData: computeFunnel(tasks),
        priorityStatusMatrix: computePriorityStatusMatrix(tasks),
        activityByType: computeActivityByType(activityLogs),
        overdueList: computeOverdueList(tasks, members),
        memberEfficiency: computeMemberEfficiency(tasks, members),
    });
}
