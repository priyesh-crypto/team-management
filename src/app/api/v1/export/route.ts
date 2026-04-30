import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { hasFeature, getEntitlement } from "@/lib/entitlements";

type ExportType = "tasks" | "members" | "time_entries" | "full";
type ExportFormat = "csv" | "json";

function toCSV(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const escape = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
    };
    const lines = [
        headers.join(","),
        ...rows.map(r => headers.map(h => escape(r[h])).join(",")),
    ];
    return lines.join("\n");
}

export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: membership } = await supabase
        .from("organization_members")
        .select("org_id, role")
        .eq("user_id", user.id)
        .single();

    if (!membership || !["manager", "admin", "owner"].includes(membership.role)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const entitlement = await getEntitlement(membership.org_id);
    if (!entitlement || !hasFeature(entitlement, "data_export")) {
        return NextResponse.json({ error: "Data export is not available on your plan" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const type = (searchParams.get("type") ?? "tasks") as ExportType;
    const format = (searchParams.get("format") ?? "csv") as ExportFormat;

    const admin = createAdminClient();
    const orgId = membership.org_id;
    let rows: Record<string, unknown>[] = [];
    let filename = "export";

    if (type === "tasks" || type === "full") {
        const { data } = await admin
            .from("tasks")
            .select("id, name, status, priority, deadline, start_date, notes, employee_id, workspace_id, created_at")
            .eq("org_id", orgId)
            .order("created_at", { ascending: false });
        if (type === "tasks") {
            rows = (data ?? []) as Record<string, unknown>[];
            filename = "tasks";
        } else {
            rows = [...(data ?? []).map(r => ({ _type: "task", ...r }))];
        }
    }

    if (type === "members" || type === "full") {
        const { data } = await admin
            .from("organization_members")
            .select("user_id, role, created_at")
            .eq("org_id", orgId);
        if (type === "members") {
            rows = (data ?? []) as Record<string, unknown>[];
            filename = "members";
        } else {
            rows = [...rows, ...(data ?? []).map(r => ({ _type: "member", ...r }))];
        }
    }

    if (type === "time_entries" || type === "full") {
        const { data } = await admin
            .from("time_entries")
            .select("id, task_id, user_id, started_at, stopped_at, hours_logged, notes, created_at")
            .eq("org_id", orgId)
            .order("started_at", { ascending: false });
        if (type === "time_entries") {
            rows = (data ?? []) as Record<string, unknown>[];
            filename = "time_entries";
        } else {
            rows = [...rows, ...(data ?? []).map(r => ({ _type: "time_entry", ...r }))];
        }
    }

    if (type === "full") filename = "full_export";

    // Log the export
    admin.from("data_exports").insert({
        org_id: orgId,
        requested_by: user.id,
        export_type: type,
        format,
        status: "ready",
        row_count: rows.length,
    }).then(() => {});

    if (format === "json") {
        return new NextResponse(JSON.stringify({ data: rows, meta: { total: rows.length, type, exported_at: new Date().toISOString() } }, null, 2), {
            headers: {
                "Content-Type": "application/json",
                "Content-Disposition": `attachment; filename="${filename}_${new Date().toISOString().split("T")[0]}.json"`,
            },
        });
    }

    const csv = toCSV(rows as Record<string, unknown>[]);
    return new NextResponse(csv, {
        headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${filename}_${new Date().toISOString().split("T")[0]}.csv"`,
        },
    });
}
