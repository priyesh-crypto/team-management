import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { getEntitlement, hasFeature } from "@/lib/entitlements";
import { ReportsDashboard } from "./ReportsDashboard";

export default async function ReportsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/");

    const { data: membership } = await supabase.from("organization_members").select("org_id").eq("user_id", user.id).single();
    if (!membership) redirect("/");

    const entitlement = await getEntitlement(membership.org_id);
    if (!entitlement || !hasFeature(entitlement, "reports_dashboards")) {
        return (
            <div className="p-10 max-w-2xl mx-auto text-center">
                <div className="text-4xl mb-4">📊</div>
                <h1 className="text-2xl font-black text-[#1d1d1f] mb-2">Reports & Dashboards</h1>
                <p className="text-slate-500">Available on the Business plan. <a href="/dashboard/settings/billing" className="text-[#0c64ef] font-bold hover:underline">Upgrade</a> to unlock.</p>
            </div>
        );
    }

    const orgId = membership.org_id;

    // Fetch aggregate data for reports
    const [tasksRes, membersRes, workspacesRes] = await Promise.all([
        supabase.from("tasks").select("id, name, status, priority, deadline, created_at, employee_id, hours_spent").eq("org_id", orgId),
        supabase.from("organization_members").select("user_id, role").eq("org_id", orgId),
        supabase.from("workspaces").select("id, name").eq("org_id", orgId),
    ]);

    const tasks = tasksRes.data ?? [];
    const members = membersRes.data ?? [];
    const workspaces = workspacesRes.data ?? [];

    // Compute stats server-side
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === "Completed").length;
    const overdue = tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== "Completed").length;
    const totalHours = tasks.reduce((s, t) => s + (Number(t.hours_spent) || 0), 0);

    // By status
    const byStatus = ["To Do", "In Progress", "In Review", "Blocked", "Completed"].map(s => ({
        status: s,
        count: tasks.filter(t => t.status === s).length,
    }));

    // By priority
    const byPriority = ["Urgent", "High", "Medium", "Low"].map(p => ({
        priority: p,
        count: tasks.filter(t => t.priority === p).length,
    }));

    // By member (top 10)
    const byMember = members.map(m => ({
        user_id: m.user_id,
        role: m.role,
        count: tasks.filter(t => t.employee_id === m.user_id).length,
        hours: tasks.filter(t => t.employee_id === m.user_id).reduce((s, t) => s + (Number(t.hours_spent) || 0), 0),
    })).sort((a, b) => b.count - a.count).slice(0, 10);

    // Completion rate last 4 weeks
    const weeks = Array.from({ length: 4 }, (_, i) => {
        const end = new Date();
        end.setDate(end.getDate() - i * 7);
        const start = new Date(end);
        start.setDate(start.getDate() - 7);
        return {
            label: `Week ${4 - i}`,
            completed: tasks.filter(t =>
                t.status === "Completed" &&
                t.created_at >= start.toISOString() &&
                t.created_at < end.toISOString()
            ).length,
        };
    }).reverse();

    return (
        <ReportsDashboard
            stats={{ total, completed, overdue, totalHours, memberCount: members.length, workspaceCount: workspaces.length }}
            byStatus={byStatus}
            byPriority={byPriority}
            byMember={byMember}
            weeklyTrend={weeks}
        />
    );
}
