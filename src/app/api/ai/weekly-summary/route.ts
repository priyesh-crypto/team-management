import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { anthropic, AI_MODEL } from "@/lib/anthropic";
import { getEntitlement, hasFeature } from "@/lib/entitlements";

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

        const { data: membership } = await supabase
            .from("organization_members")
            .select("org_id")
            .eq("user_id", user.id)
            .single();
        if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

        const entitlement = await getEntitlement(membership.org_id);
        if (!entitlement || !hasFeature(entitlement, "ai_weekly_summary")) {
            return NextResponse.json({ error: "Feature not available on your plan" }, { status: 403 });
        }

        const admin = createAdminClient();
        const orgId = membership.org_id;

        // Compute week_start (last Monday)
        const now = new Date();
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - daysToMonday);
        weekStart.setHours(0, 0, 0, 0);
        const weekStartStr = weekStart.toISOString().split("T")[0];

        // Check if summary already exists this week
        const { data: existing } = await admin
            .from("ai_summaries")
            .select("*")
            .eq("org_id", orgId)
            .eq("week_start", weekStartStr)
            .maybeSingle();

        if (existing) return NextResponse.json({ summary: existing });

        // Fetch last 7 days of activity
        const sevenDaysAgo = new Date(weekStart);
        sevenDaysAgo.setDate(weekStart.getDate() - 7);

        const [tasksRes, completedRes, overdueRes] = await Promise.all([
            admin.from("tasks").select("id, name, status, priority, deadline").eq("org_id", orgId).gte("created_at", sevenDaysAgo.toISOString()),
            admin.from("tasks").select("id").eq("org_id", orgId).eq("status", "Completed").gte("updated_at", sevenDaysAgo.toISOString()),
            admin.from("tasks").select("id").eq("org_id", orgId).eq("status", "Overdue"),
        ]);

        const stats = {
            new_tasks: tasksRes.data?.length ?? 0,
            completed_tasks: completedRes.data?.length ?? 0,
            overdue_tasks: overdueRes.data?.length ?? 0,
            high_priority: tasksRes.data?.filter(t => t.priority === "Urgent" || t.priority === "High").length ?? 0,
        };

        const recentTaskNames = (tasksRes.data ?? [])
            .slice(0, 10)
            .map(t => `- ${t.name} (${t.status}, ${t.priority})`)
            .join("\n");

        const prompt = `You are a project management assistant writing a weekly team summary.

Week of: ${weekStartStr}
Stats:
- New tasks created: ${stats.new_tasks}
- Tasks completed: ${stats.completed_tasks}
- Currently overdue: ${stats.overdue_tasks}
- High/Urgent priority: ${stats.high_priority}

Recent tasks:
${recentTaskNames || "(none)"}

Write a concise, encouraging weekly summary for the team. 3-4 sentences. Highlight wins, flag concerns, motivate the team.
Return ONLY the summary text, no JSON, no headers.`;

        const message = await anthropic.messages.create({
            model: AI_MODEL,
            max_tokens: 512,
            messages: [{ role: "user", content: prompt }],
        });

        const summaryText = message.content[0].type === "text" ? message.content[0].text : "";

        const { data: saved } = await admin
            .from("ai_summaries")
            .insert({
                org_id: orgId,
                week_start: weekStartStr,
                summary_text: summaryText,
                model: AI_MODEL,
                stats_snapshot: stats,
            })
            .select()
            .single();

        return NextResponse.json({ summary: saved });
    } catch (err) {
        console.error("[AI weekly-summary]", err);
        return NextResponse.json({ error: "AI request failed" }, { status: 500 });
    }
}

export async function GET() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

        const { data: membership } = await supabase
            .from("organization_members")
            .select("org_id")
            .eq("user_id", user.id)
            .single();
        if (!membership) return NextResponse.json({ summaries: [] });

        const { data } = await supabase
            .from("ai_summaries")
            .select("*")
            .eq("org_id", membership.org_id)
            .order("week_start", { ascending: false })
            .limit(12);

        return NextResponse.json({ summaries: data ?? [] });
    } catch {
        return NextResponse.json({ summaries: [] });
    }
}
