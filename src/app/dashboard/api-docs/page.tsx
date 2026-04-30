import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { APIDocsClient } from "./APIDocsClient";

export default async function APIDocsPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/");

    const { data: membership } = await supabase
        .from("organization_members")
        .select("org_id, role")
        .eq("user_id", user.id)
        .single();

    if (!membership) redirect("/dashboard");

    return <APIDocsClient orgId={membership.org_id} />;
}
