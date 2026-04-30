import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { PortalClient } from "./PortalClient";

export default async function PortalPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/?error=auth_required");

    // Find guest memberships
    const { data: memberships } = await supabase
        .from("organization_members")
        .select("org_id, role, organizations(name)")
        .eq("user_id", user.id)
        .eq("role", "guest");

    if (!memberships || memberships.length === 0) {
        redirect("/dashboard");
    }

    const orgId = memberships[0].org_id;
    const orgName = Array.isArray(memberships[0].organizations)
        ? memberships[0].organizations[0]?.name
        : (memberships[0].organizations as { name: string } | null)?.name ?? "Your workspace";

    // Fetch tasks assigned to this guest
    const { data: tasks } = await supabase
        .from("tasks")
        .select("id, name, status, priority, deadline, notes, start_date")
        .eq("org_id", orgId)
        .or(`employee_id.eq.${user.id},assignee_ids.cs.{${user.id}}`)
        .neq("status", "Completed")
        .order("deadline", { ascending: true });

    return <PortalClient orgName={orgName} tasks={tasks ?? []} />;
}
