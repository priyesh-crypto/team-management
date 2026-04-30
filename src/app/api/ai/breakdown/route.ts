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
        if (!entitlement || !hasFeature(entitlement, "ai_breakdown")) {
            return NextResponse.json({ error: "Feature not available on your plan" }, { status: 403 });
        }

        const { taskId, taskName, taskNotes } = await req.json() as {
            taskId: string;
            taskName: string;
            taskNotes?: string;
        };

        if (!taskId || !taskName) {
            return NextResponse.json({ error: "taskId and taskName required" }, { status: 400 });
        }

        const prompt = `You are a project management assistant. Break down this task into 3-8 actionable subtasks.

Task: ${taskName}
${taskNotes ? `Description: ${taskNotes}` : ""}

Return a JSON array of subtask objects. Each object must have:
- "name": string (clear, action-oriented subtask title, max 80 chars)
- "estimated_hours": number (realistic estimate, e.g. 0.5, 1, 2)

Return ONLY valid JSON array, no markdown, no explanation.`;

        const message = await anthropic.messages.create({
            model: AI_MODEL,
            max_tokens: 1024,
            messages: [{ role: "user", content: prompt }],
        });

        const raw = message.content[0].type === "text" ? message.content[0].text : "[]";
        let suggestions: Array<{ name: string; estimated_hours: number }>;
        try {
            suggestions = JSON.parse(raw);
            if (!Array.isArray(suggestions)) throw new Error("Not an array");
        } catch {
            return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
        }

        // Persist suggestion to DB
        const admin = createAdminClient();
        const { data: saved } = await admin
            .from("ai_suggestions")
            .insert({
                org_id: membership.org_id,
                task_id: taskId,
                created_by: user.id,
                type: "subtask_breakdown",
                suggestions,
                model: AI_MODEL,
            })
            .select("id")
            .single();

        return NextResponse.json({ suggestions, suggestionId: saved?.id });
    } catch (err: unknown) {
        console.error("[AI breakdown]", err);
        return NextResponse.json({ error: "AI request failed" }, { status: 500 });
    }
}
