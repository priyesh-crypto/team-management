"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";

export type GitHubConnection = {
    id: string;
    github_org: string | null;
    repos: { owner: string; name: string; full_name: string }[];
    is_active: boolean;
    created_at: string;
};

export type GitHubLink = {
    id: string;
    task_id: string;
    repo: string;
    link_type: string;
    ref_number: number | null;
    ref_sha: string | null;
    title: string | null;
    state: string | null;
    url: string | null;
    created_at: string;
};

export async function getGitHubConnection(orgId: string): Promise<GitHubConnection | null> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("github_connections")
        .select("id, github_org, repos, is_active, created_at")
        .eq("org_id", orgId)
        .maybeSingle();
    return data as GitHubConnection | null;
}

export async function saveGitHubConnection(orgId: string, params: {
    github_org: string;
    access_token: string;
    repos: { owner: string; name: string; full_name: string }[];
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { error } = await supabase
        .from("github_connections")
        .upsert({
            org_id: orgId,
            github_org: params.github_org,
            access_token: params.access_token,
            repos: params.repos,
            connected_by: user.id,
            is_active: true,
            updated_at: new Date().toISOString(),
        }, { onConflict: "org_id" });

    if (error) return { error: error.message };
    revalidatePath("/dashboard/settings/integrations");
    return { ok: true };
}

export async function disconnectGitHub(orgId: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("github_connections")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("org_id", orgId);
    if (error) return { error: error.message };
    revalidatePath("/dashboard/settings/integrations");
    return { ok: true };
}

export async function getTaskGitHubLinks(taskId: string): Promise<GitHubLink[]> {
    const supabase = await createClient();
    const { data } = await supabase
        .from("task_github_links")
        .select("id, task_id, repo, link_type, ref_number, ref_sha, title, state, url, created_at")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
    return (data ?? []) as GitHubLink[];
}

export async function linkGitHubRef(params: {
    taskId: string;
    orgId: string;
    repo: string;
    linkType: "pr" | "commit" | "issue";
    refNumber?: number;
    refSha?: string;
    title?: string;
    state?: string;
    url?: string;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "Unauthorized" };

    const { data, error } = await supabase
        .from("task_github_links")
        .insert({
            task_id: params.taskId,
            org_id: params.orgId,
            repo: params.repo,
            link_type: params.linkType,
            ref_number: params.refNumber ?? null,
            ref_sha: params.refSha ?? null,
            title: params.title ?? null,
            state: params.state ?? null,
            url: params.url ?? null,
            linked_by: user.id,
        })
        .select("id, task_id, repo, link_type, ref_number, ref_sha, title, state, url, created_at")
        .single();

    if (error) return { error: error.message };
    return { data };
}

export async function unlinkGitHubRef(linkId: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from("task_github_links")
        .delete()
        .eq("id", linkId);
    if (error) return { error: error.message };
    return { ok: true };
}

// Fetch PR details from GitHub API using stored token
export async function fetchGitHubPR(orgId: string, repo: string, prNumber: number) {
    const admin = createAdminClient();
    const { data: conn } = await admin
        .from("github_connections")
        .select("access_token")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .maybeSingle();

    if (!conn?.access_token) return { error: "GitHub not connected" };

    const res = await fetch(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {
        headers: { Authorization: `token ${conn.access_token}`, Accept: "application/vnd.github.v3+json" },
    });

    if (!res.ok) return { error: `GitHub API error: ${res.status}` };
    const pr = await res.json() as { title: string; state: string; html_url: string; head: { sha: string } };
    return {
        data: {
            title: pr.title,
            state: pr.state,
            url: pr.html_url,
            sha: pr.head.sha,
        },
    };
}
