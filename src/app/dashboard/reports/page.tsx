import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getEntitlement, hasFeature } from "@/lib/entitlements";
import { ReportsDashboard } from "./ReportsDashboard";
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

export default async function ReportsPage({
    searchParams,
}: {
    searchParams?: Promise<{ range?: string }>;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/");

    const { data: membership } = await supabase
        .from("organization_members")
        .select("org_id")
        .eq("user_id", user.id)
        .maybeSingle();
    if (!membership) redirect("/");

    const entitlement = await getEntitlement(membership.org_id);
    if (!entitlement || !hasFeature(entitlement, "reports_dashboards")) {
        return (
            <div className="p-10 max-w-2xl mx-auto text-center">
                <div className="text-4xl mb-4">📊</div>
                <h1 className="text-2xl font-black text-[#1d1d1f] mb-2">
                    Reports & Dashboards
                </h1>
                <p className="text-slate-500">
                    Available on the Business plan.{" "}
                    <a
                        href="/dashboard/settings/billing"
                        className="text-[#0051e6] font-bold hover:underline"
                    >
                        Upgrade
                    </a>{" "}
                    to unlock.
                </p>
            </div>
        );
    }

    const orgId = membership.org_id;
    const resolvedParams = await searchParams;
    const range = Math.min(365, Math.max(7, Number(resolvedParams?.range) || 30));

    const [tasksRes, membersRes, workspacesRes, projectsRes, activityRes] =
        await Promise.all([
            supabase
                .from("tasks")
                .select(
                    "id, name, status, priority, deadline, created_at, start_date, employee_id, hours_spent, workspace_id, project_id"
                )
                .eq("org_id", orgId),
            supabase
                .from("organization_members")
                .select("user_id, role, profiles(name)")
                .eq("org_id", orgId),
            supabase.from("workspaces").select("id, name").eq("org_id", orgId),
            supabase.from("projects").select("id, name, color").eq("org_id", orgId),
            supabase
                .from("activity_logs")
                .select("type, created_at")
                .eq("org_id", orgId)
                .gte(
                    "created_at",
                    new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
                ),
        ]);

    const allTasks = (tasksRes.data ?? []) as any[];
    const members = (membersRes.data ?? []) as any[];
    const workspaces = (workspacesRes.data ?? []) as any[];
    const projects = (projectsRes.data ?? []) as any[];
    const activityLogs = (activityRes.data ?? []) as any[];

    const tasks = filterByRange(allTasks, range);

    const byStatus = ["To Do", "In Progress", "In Review", "Blocked", "Completed"].map(
        s => ({
            status: s,
            count: tasks.filter(t => t.status === s).length,
        })
    );

    const byPriority = ["Urgent", "High", "Medium", "Low"].map(p => ({
        priority: p,
        count: tasks.filter(t => t.priority === p).length,
    }));

    const baseStats = computeStats(tasks, members.length, workspaces.length, projects.length);
    const sparklines = computeSparklines(allTasks, 4);

    return (
        <ReportsDashboard
            range={range}
            stats={{ ...baseStats, sparklines }}
            byStatus={byStatus}
            byPriority={byPriority}
            byMember={computeByMember(tasks, members)}
            byProject={computeByProject(tasks, projects)}
            byWorkspace={computeByWorkspace(tasks, workspaces)}
            weeklyTrend={computeWeeklyTrend(allTasks, 8)}
            dailyActivity={computeExtendedHeatmap(allTasks, 84)}
            cycleTimeBuckets={computeCycleTimeBuckets(tasks)}
            agingBuckets={computeAgingBuckets(tasks)}
            funnelData={computeFunnel(tasks)}
            priorityStatusMatrix={computePriorityStatusMatrix(tasks)}
            activityByType={computeActivityByType(activityLogs)}
            overdueList={computeOverdueList(tasks, members)}
            memberEfficiency={computeMemberEfficiency(tasks, members)}
        />
    );
}
