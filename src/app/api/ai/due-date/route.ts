import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
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
        if (!entitlement || !hasFeature(entitlement, "smart_due_dates")) {
            return NextResponse.json({ error: "Feature not available on your plan" }, { status: 403 });
        }

        const { taskName, taskNotes, priority, estimatedHours, startDate } = await req.json() as {
            taskName: string;
            taskNotes?: string;
            priority?: string;
            estimatedHours?: number;
            startDate?: string;
        };

        const today = new Date().toISOString().split("T")[0];
        const prompt = `You are a project management assistant. Suggest a realistic due date for this task.

Today: ${today}
Task: ${taskName}
${taskNotes ? `Description: ${taskNotes}` : ""}
Priority: ${priority ?? "Medium"}
${estimatedHours ? `Estimated hours: ${estimatedHours}` : ""}
${startDate ? `Start date: ${startDate}` : ""}

Consider: business days only, realistic buffer for reviews, typical project overhead.

Return ONLY valid JSON with this shape (no markdown):
{
  "suggested_date": "YYYY-MM-DD",
  "reasoning": "one sentence explanation"
}`;

        const message = await anthropic.messages.create({
            model: AI_MODEL,
            max_tokens: 256,
            messages: [{ role: "user", content: prompt }],
        });

        const raw = message.content[0].type === "text" ? message.content[0].text : "{}";
        let result: { suggested_date: string; reasoning: string };
        try {
            result = JSON.parse(raw);
        } catch {
            return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
        }

        return NextResponse.json(result);
    } catch (err) {
        console.error("[AI due-date]", err);
        return NextResponse.json({ error: "AI request failed" }, { status: 500 });
    }
}
