"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export type SavedView = {
    id: string;
    org_id: string;
    owner_id: string;
    name: string;
    view_state: Record<string, unknown>;
    is_shared: boolean;
    created_at: string;
};

async function getOrgId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string> {
    const { data } = await supabase
        .from("organization_members")
        .select("org_id")
        .eq("user_id", userId)
        .single();
    if (!data) throw new Error("Not a member of any organization");
    return data.org_id;
}

export async function getSavedViews(): Promise<SavedView[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");

    const { data, error } = await supabase
        .from("saved_views")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as SavedView[];
}

export async function saveView(input: {
    name: string;
    view_state: Record<string, unknown>;
    is_shared?: boolean;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");
    const orgId = await getOrgId(supabase, user.id);

    const { error } = await supabase.from("saved_views").insert({
        org_id: orgId,
        owner_id: user.id,
        name: input.name,
        view_state: input.view_state,
        is_shared: input.is_shared ?? false,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}

export async function deleteSavedView(id: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthenticated");

    const { error } = await supabase.from("saved_views").delete().eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/dashboard");
}
