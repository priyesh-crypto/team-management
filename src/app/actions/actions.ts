"use server"

import { createClient } from "@/utils/supabase/server"
import { cache } from "react"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { applyRateLimit } from "@/utils/rate-limit"
import { Resend } from 'resend'
import { formatDistanceToNow, format } from 'date-fns'
import crypto from 'crypto'
import { sanitizeString, validateEmail, validateId, validatePasswordStrength, checkFileSecurity } from "@/utils/security"

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export type Profile = {
    id: string
    name: string
    role: 'employee' | 'manager' | 'admin' | 'owner'
    email?: string
}

export type Priority = 'Urgent' | 'High' | 'Medium' | 'Low'
export type Status = 'To Do' | 'In Progress' | 'In Review' | 'Completed' | 'Blocked' | 'Overdue'

export type Task = {
    id: string
    org_id: string
    workspace_id: string
    project_id?: string
    employee_id: string // Owner
    assignee_ids?: string[] // Collaborators
    name: string
    start_date: string
    deadline: string
    start_time?: string
    end_time?: string
    priority: Priority
    hours_spent: number
    status: Status
    notes: string
    created_at: string
}

export type Subtask = {
    id: string;
    org_id: string;
    task_id: string;
    employee_id: string; // Contributor
    name: string;
    hours_spent: number;
    weight?: number;
    estimated_hours?: number;
    is_completed: boolean;
    start_time?: string;
    end_time?: string;
    date_logged?: string;
    created_at: string;
}

export type Attachment = {
    id: string;
    task_id: string;
    uploader_id: string;
    file_name: string;
    file_url: string;
    file_type?: string;
    file_size?: number;
    created_at: string;
}

export type Comment = {
    id: string;
    org_id: string; // Added for tenant isolation
    task_id: string;
    author_id: string;
    content: string;
    created_at: string;
    author_name?: string;
}

export type Notification = {
    id: string;
    org_id: string; // Added for tenant isolation
    user_id: string;
    type: 'urgent' | 'overdue' | 'comment' | 'system';
    message: string;
    is_read: boolean;
    task_id?: string;
    created_at: string;
}

export type ActivityLog = {
    id: string;
    org_id: string;
    actor_id: string;
    actor_name?: string; // Joined from profiles
    task_id?: string;
    type: 'task_created' | 'task_updated' | 'task_deleted' | 'task_status_changed'
    | 'task_priority_changed'
    | 'comment_added'
    | 'comment_deleted'
    | 'subtask_created' | 'subtask_updated' | 'subtask_deleted'
    | 'attachment_added'
    | 'attachment_deleted'
    | 'member_invited'
    | 'member_joined'
    | 'subtask_completed'
    | 'system_error'
    | 'security_event';
    description: string;
    metadata?: Record<string, any>;
    created_at: string;
}

export type WorkloadDayData = {
    tasks: number;
    hours: number;
    urgency: number;
}

export type WorkloadMemberData = {
    name: string;
    days: {
        [date: string]: WorkloadDayData;
    };
}

export type WorkloadMap = {
    [userId: string]: WorkloadMemberData;
};

export type DigestPreferences = {
    user_id: string;
    channel: 'email' | 'slack' | 'both' | 'none';
    send_time: string;
    timezone: string;
    slack_user_id?: string;
    send_on_weekends: boolean;
    is_active: boolean;
};

export type AuditLog = {
  id: string;
  org_id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: any;
  new_data: any;
  changed_fields: string[] | null;
  actor_id: string | null;
  actor_name: string | null;
  target_name: string | null;
  ip_address: string | null;
  created_at: string;
};

export type Project = {
    id: string
    org_id: string
    name: string
    description?: string
    color: string
    icon: string
    status: 'active' | 'archived'
    created_by: string
    created_at: string
    updated_at: string
    // Virtual fields
    task_count?: number
    member_count?: number
}

export type ProjectMember = {
    project_id: string
    user_id: string
    role: 'lead' | 'member' | 'viewer'
    joined_at: string
}



// Rate limiting helpers moved to @/utils/rate-limit.ts

/**
 * requireOrgContext fetches the current user and their organization context.
 * We wrap this in React's cache() so that it only executes ONCE per request,
 * even if called multiple times in Layouts, Pages, and child Components.
 */
export const requireOrgContext = cache(async () => {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
        throw new Error("Unauthorized: Please sign in.");
    }

    const { data: mData, error: memberError } = await supabase
        .from('organization_members')
        .select('org_id, role')
        .eq('user_id', user.id)
    
    if (memberError || !mData || mData.length === 0) {
        throw new Error("Unauthorized: You do not belong to an organization.");
    }

    const selectedMember = mData[0];

    const { data: workspaces } = await supabase
        .from('workspaces')
        .select('id')
        .eq('org_id', selectedMember.org_id)
        .limit(1)

    const workspace = workspaces?.[0];

    return {
        userId: user.id,
        orgId: selectedMember.org_id,
        role: selectedMember.role as 'owner' | 'manager' | 'employee' | 'admin',
        workspaceId: workspace?.id
    };
});

export async function getProfiles(projectId?: string, providedAuthUsers?: any[], providedOrgId?: string): Promise<Profile[]> {
    const supabase = await createClient()
    
    let orgId = providedOrgId;
    let userId;
    try {
        if (!orgId) {
            const context = await requireOrgContext();
            orgId = context.orgId;
            userId = context.userId;
        }
    } catch (e) {
        return []; // If not logged in or no org, return empty
    }

    // 1. Get members (Either organization-wide or project-specific)
    let query = supabase
        .from(projectId ? 'project_members' : 'organization_members')
        .select('user_id, role')
        .eq(projectId ? 'project_id' : 'org_id', projectId || orgId);

    const { data: members, error: memError } = await query;

    if (memError || !members) {
        console.error("[getProfiles] error:", memError);
        return [];
    }
    
    console.log(`[getProfiles] found ${members.length} members for project ${projectId || 'org'}`);
    
    const userIds = members.map(m => m.user_id);
    if (userIds.length === 0) {
        console.log("[getProfiles] userIds is empty");
        return [];
    }

    // 2. Fetch profiles from database
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);
    
    if (error) {
        console.error("[getProfiles] profiles error:", error);
    }

    // 3. Fetch emails from Auth for these users (since profiles.email might be missing)
    // REMOVED listUsers() for performance. Relying on profiles table for email.
    let authUsers: any[] = providedAuthUsers || [];

    // Use MEMBERS as the source of truth to ensure everyone is listed
    return members.map(m => {
        const p = (profiles || []).find(prof => prof.id === m.user_id);
        const a = authUsers.find(au => au.id === m.user_id);
        
        return {
            id: m.user_id,
            name: p?.name || 'Team Member',
            email: p?.email || a?.email || '',
            role: p?.role || m.role || 'employee'
        } as Profile;
    });
}


export async function getSubtasks(taskId: string): Promise<Subtask[]> {
    const { orgId } = await requireOrgContext();
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('task_id', taskId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })
        
    if (error) {
        console.error("Error fetching subtasks:", error)
        return []
    }
    return data || []
}

export async function getBulkSubtasks(taskIds: string[]): Promise<Subtask[]> {
    if (!taskIds.length) return []
    const { orgId } = await requireOrgContext();
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .in('task_id', taskIds)
        .eq('org_id', orgId)
    if (error) {
        console.error("Error fetching bulk subtasks:", error)
        return []
    }
    return data || []
}

export async function getTasks(projectId?: string, providedOrgId?: string): Promise<Task[]> {
    try {
        const supabase = await createClient()
        let orgId = providedOrgId;
        if (!orgId) {
            const context = await requireOrgContext().catch(() => null);
            if (!context) {
                console.warn("[getTasks] No organization context found.");
                return [];
            }
            orgId = context.orgId;
        }

        // We query the tasks table directly to be robust against view creation failures
        // Windowing: Only fetch tasks updated in the last 90 days to prevent 504 timeouts
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        let query = supabase
            .from('tasks')
            .select('*')
            .eq('org_id', orgId)
            .gte('updated_at', ninetyDaysAgo.toISOString());
        
        if (projectId && projectId !== 'all') {
            query = query.eq('project_id', projectId);
        }

        const { data, error } = await query;
        
        if (error) {
            console.error("[getTasks] Supabase Error:", error);
            // Fallback: try without the join if projects table is missing
            if (error.code === '42P01') { // relation does not exist
                console.log("[getTasks] Projects table not found, falling back to simple task query");
                const { data: simpleData, error: simpleError } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('org_id', orgId);
                
                if (simpleError) {
                    console.error("[getTasks] Fallback Error:", simpleError);
                    return [];
                }
                return simpleData || [];
            }
            return [];
        }

        console.log(`[getTasks] Fetched ${(data || []).length} tasks for org ${orgId} (Project: ${projectId || 'all'})`);

        // Map join data to expected format if needed
        const tasks = (data || []).map((t: any) => ({
            ...t,
            project_name: t.project?.name,
            project_color: t.project?.color,
            project_icon: t.project?.icon,
            assignee_name: t.profiles?.name
        })) as Task[];

        return tasks;
    } catch (err) {
        console.error("[getTasks] Unexpected Error:", err);
        return [];
    }
}

export async function getProjects(providedOrgId?: string): Promise<Project[]> {
    const supabase = await createClient()
    let orgId = providedOrgId;
    if (!orgId) {
        const context = await requireOrgContext().catch(() => null);
        if (!context) return [];
        orgId = context.orgId;
    }

    const { data, error } = await supabase
        .from('projects')
        .select(`
            *,
            project_members(count),
            tasks(count)
        `)
        .eq('org_id', orgId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching projects:", error);
        return [];
    }
    
    return (data || []).map((p: any) => ({
        ...p,
        member_count: p.project_members?.[0]?.count || 0,
        task_count: p.tasks?.[0]?.count || 0
    })) as Project[];
}

export async function getProject(projectId: string): Promise<Project | null> {
    const { orgId } = await requireOrgContext();
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('org_id', orgId)
        .single()

    if (error) {
        console.error("Error fetching project:", error)
        return null
    }
    return data
}

export async function createProject(input: {
    name: string
    description?: string
    color: string
    memberIds: string[]
}) {
    const { userId, orgId } = await requireOrgContext();
    const supabase = await createClient();

    // Verify manager role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
    
    if (profile?.role !== 'manager') {
        throw new Error("Unauthorized: Only managers can create projects.");
    }

    const { data: project, error } = await supabase
        .from('projects')
        .insert({
            name: input.name,
            description: input.description,
            color: input.color,
            org_id: orgId,
            created_by: userId
        })
        .select()
        .single();

    if (error) {
        console.error("Error creating project:", error);
        throw error;
    }

    // Add selected members
    const members = [
        { project_id: project.id, user_id: userId, role: 'lead' },
        ...input.memberIds.filter(id => id !== userId).map(uid => ({
            project_id: project.id,
            user_id: uid,
            role: 'member' as const
        }))
    ];

    const { error: membersError } = await supabase.from('project_members').insert(members);
    
    if (membersError) {
        console.error("Error adding project members:", membersError);
        throw new Error("Project created but failed to add team members: " + membersError.message);
    }
    
    revalidatePath('/dashboard');
    return project;
}

export async function deleteProject(id: string) {
    const supabase = await createClient();
    const { orgId, userId } = await requireOrgContext();

    // Verify manager role for security
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
    
    if (profile?.role !== 'manager') {
        throw new Error("Unauthorized: Only managers can delete projects.");
    }

    const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id)
        .eq('org_id', orgId);

    if (error) {
        console.error("Error deleting project:", error);
        throw error;
    }

    revalidatePath('/dashboard');
}

export async function logout() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/');
}

export async function saveTask(taskData: Omit<Task, "id" | "created_at" | "org_id" | "workspace_id">) {
  try {
    await applyRateLimit('saveTask', 50, 60 * 60 * 1000);
    const { userId, orgId, workspaceId } = await requireOrgContext();
    console.log("[saveTask] Context:", { userId, orgId, workspaceId });
    if (!workspaceId) return { success: false, error: "No default workspace found for organization." };

    const supabase = await createClient();
    console.log("[saveTask] Supabase client created");

    // Duplication Check (scoped to project)
    const { data: existingTask, error: checkError } = await supabase
      .from("tasks")
      .select("id")
      .ilike("name", taskData.name)
      .eq("org_id", orgId)
      .filter('project_id', taskData.project_id ? 'eq' : 'is', taskData.project_id || null)
      .limit(1)
      .maybeSingle();

    if (checkError) console.error("Error checking for duplicate task:", checkError);
    if (existingTask) return { success: false, error: `A task with the name "${taskData.name}" already exists in this project.` };

    const sanitizedData = {
      ...taskData,
      name: sanitizeString(taskData.name),
      notes: sanitizeString(taskData.notes),
      project_id: validateId(taskData.project_id) ? taskData.project_id : null,
      employee_id: validateId(taskData.employee_id) ? taskData.employee_id : null,
    };

    if (!sanitizedData.name) {
      return { success: false, error: "Task name is required and cannot be only special characters." };
    }

    const { data: task, error } = await supabase
      .from("tasks")
      .insert([{ ...sanitizedData, org_id: orgId, workspace_id: workspaceId }])
      .select()
      .single();
    
    console.log("[saveTask] Insert result:", { task, error });

    if (error) {
      console.error("Error saving task:", error);
      return { success: false, error: error.message };
    }

    if (task) {
      // Parallelize non-dependent operations
      const operations: Promise<any>[] = [
        logActivity({
          org_id: orgId,
          actor_id: userId,
          task_id: task.id,
          type: "task_created",
          description: `Created new task: "${task.name}"`,
          metadata: { name: task.name },
        }),
        createNotification({
          org_id: orgId,
          user_id: task.employee_id,
          type: "system",
          message: `New task assigned: ${task.name}`,
          task_id: task.id,
        })
      ];

      // Initial work log subtask
      if (task.hours_spent > 0) {
        operations.push((async () => {
          const { error: subtaskError } = await supabase.from('subtasks').insert([{
            task_id: task.id,
            employee_id: task.employee_id,
            org_id: orgId,
            name: `Initial work log for "${task.name}"`,
            hours_spent: task.hours_spent,
            is_completed: true,
            date_logged: new Date().toISOString().split('T')[0],
            start_time: '09:00',
            end_time: '17:00'
          }]);
          if (subtaskError) console.error("[saveTask] Initial subtask error:", subtaskError);
        })());
      }

      // Collaborator notifications
      if (task.assignee_ids && task.assignee_ids.length > 0) {
        task.assignee_ids.forEach((assigneeId: string) => {
          if (assigneeId !== task.employee_id) {
            operations.push(createNotification({
              org_id: orgId,
              user_id: assigneeId,
              type: "system",
              message: `You were added as a collaborator to: ${task.name}`,
              task_id: task.id,
            }));
          }
        });
      }

      await Promise.all(operations).catch(err => console.warn("Background operations failed:", err));
    }

    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error in saveTask:", err);
    return { success: false, error: err.message || "An unexpected error occurred" };
  }
}

export async function updateTask(taskId: string, taskData: Partial<Omit<Task, 'id' | 'created_at' | 'org_id' | 'workspace_id'>>) {
    const { userId, orgId } = await requireOrgContext();
    const supabase = await createClient()

    const { id: _id, created_at: _created_at, ...rawUpdateData } = taskData as any;
    const sanitizedData = {
        ...rawUpdateData,
        name: rawUpdateData.name ? sanitizeString(rawUpdateData.name) : undefined,
        notes: rawUpdateData.notes ? sanitizeString(rawUpdateData.notes) : undefined,
        project_id: validateId(rawUpdateData.project_id) ? rawUpdateData.project_id : (rawUpdateData.project_id === "" ? null : undefined),
        employee_id: validateId(rawUpdateData.employee_id) ? rawUpdateData.employee_id : (rawUpdateData.employee_id === "" ? null : undefined),
    };

    // Remove undefined fields to avoid accidental updates
    Object.keys(sanitizedData).forEach(key => (sanitizedData as any)[key] === undefined && delete (sanitizedData as any)[key]);

    const { data: task, error } = await supabase
        .from('tasks')
        .update(sanitizedData)
        .eq('id', taskId)
        .eq('org_id', orgId)
        .select()
        .single()

    if (error) {
        console.error("Error updating task:", error)
        throw new Error(error.message)
    }

    if (task) {
        await logActivity({
            org_id: orgId,
            actor_id: userId,
            task_id: task.id,
            type: 'task_updated',
            description: `Updated task details for "${task.name}"`,
            metadata: { name: task.name, updates: sanitizedData }
        });

        if (taskData.employee_id) {
            await createNotification({
                org_id: orgId,
                user_id: task.employee_id,
                type: 'system',
                message: `Task assignment updated: ${task.name}`,
                task_id: task.id
            });
        }
    }

    revalidatePath('/dashboard')
}

export async function inviteMember(email: string, role: string): Promise<{ success: boolean; error?: string }> {
    try {
        await applyRateLimit('inviteMember', 10, 60 * 60 * 1000);
        if (!validateEmail(email)) return { success: false, error: "Invalid email address format." };
        const sanitizedEmail = email.toLowerCase().trim();
        const { userId, orgId, role: currentUserRole } = await requireOrgContext();
        if (currentUserRole !== 'owner' && currentUserRole !== 'admin' && currentUserRole !== 'manager') {
            return { success: false, error: "Unauthorized to invite members." };
        }

        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
            return { success: false, error: "Server configuration error: Missing Service Role Key." };
        }

        const { createClient: createAdminClient } = await import('@supabase/supabase-js')
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // 1. Create/Update Invite Record (Upsert to allow resending)
        // We use gen_random_uuid() for the token to ensure a fresh link on resend
        const newToken = crypto.randomUUID();
        const { data: invite, error: inviteError } = await supabaseAdmin
            .from('invitations')
            .upsert(
                { 
                    org_id: orgId, 
                    email: email.toLowerCase(), 
                    role,
                    token: newToken,
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // reset expiry
                }, 
                { onConflict: 'org_id, email' }
            )
            .select()
            .single();
            
        if (inviteError) {
            console.error("Error creating/updating invite:", inviteError);
            return { success: false, error: "Failed to process invitation: " + inviteError.message };
        }

        // 2. Send Email
        const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invite/${invite.token}`;
        const fromEmail = process.env.RESEND_FROM_EMAIL || 'Mindbird Team <onboarding@resend.dev>';

        if (resend) {
            // Fetch org name for the email
            const { data: org } = await supabaseAdmin.from('organizations').select('name').eq('id', orgId).single();
            const orgName = org?.name || "an organization";

            try {
                const { data, error } = await resend.emails.send({
                    from: fromEmail,
                    to: email,
                    subject: `You have been invited to join ${orgName}`,
                    html: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 12px;">
                            <h2 style="color: #1d1d1f; margin-bottom: 24px;">You've been invited!</h2>
                            <p style="color: #424245; line-height: 1.5;">You have been invited to join <strong>${orgName}</strong> as a <strong>${role}</strong>.</p>
                            <p style="color: #424245; line-height: 1.5; margin-bottom: 32px;">Click the button below to set up your account and get started:</p>
                            <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0071e3; color: white; text-decoration: none; border-radius: 980px; font-weight: 600; font-size: 14px;">Accept Invitation</a>
                            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e1e1e1;">
                                <p style="font-size: 12px; color: #86868b; line-height: 1.4;">If you're having trouble clicking the button, copy and paste this URL into your browser:<br/>${inviteUrl}</p>
                                <p style="font-size: 12px; color: #86868b; margin-top: 12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
                            </div>
                        </div>
                    `
                });

                if (error) {
                    console.error("Resend error detail:", error);
                    let errorMsg = error.message;
                    if (fromEmail.includes('onboarding@resend.dev') && !errorMsg.includes('authorized')) {
                        errorMsg += " (Note: Using onboarding@resend.dev - ensure recipient is authorized in Resend dashboard)";
                    }
                    return { success: false, error: `Email failed: ${errorMsg}. MANUALLY: ${inviteUrl}` };
                }

                await logActivity({
                    org_id: orgId,
                    actor_id: userId,
                    type: 'member_invited',
                    description: `Invited ${email} as ${role}`,
                    metadata: { email, role }
                });

                return { success: true };
            } catch (e: any) {
                console.error("Failed to send invite email:", e);
                // Return success: false because the PRIMARY goal (inviting via email) failed
                return { success: false, error: `Invitation record created, but email failed. PLEASE SHARE MANUALLY: ${inviteUrl}` };
            }
        } else {
            console.warn("Resend is not configured. Invite URL:", inviteUrl);
            return { success: false, error: `Email service not configured. PLEASE SHARE MANUALLY: ${inviteUrl}` };
        }
    } catch (err: any) {
        console.error("Unexpected error in inviteMember:", err);
        return { success: false, error: err.message || "An unexpected error occurred." };
    }
}

export async function addMemberDirectly(data: { name: string, email: string, role: string, password: string }): Promise<{ success: boolean; error?: string }> {
    try {
        await applyRateLimit('addMemberDirectly', 10, 60 * 60 * 1000);
        if (!validateEmail(data.email)) return { success: false, error: "Invalid email address format." };
        if (!validatePasswordStrength(data.password)) return { success: false, error: "Password does not meet strength requirements (min 8 chars, mixed case, and numbers)." };
        
        const { userId, orgId, role: currentUserRole } = await requireOrgContext();
        if (currentUserRole !== 'owner' && currentUserRole !== 'admin' && currentUserRole !== 'manager') {
            return { success: false, error: "Unauthorized to add members." };
        }

        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
            return { success: false, error: "Server configuration error: Missing Service Role Key." };
        }

        const { createClient: createAdminClient } = await import('@supabase/supabase-js')
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY,
            { auth: { autoRefreshToken: false, persistSession: false } }
        )

        // 1. Create Auth User
        const { data: userObj, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password,
            user_metadata: { name: data.name, role: data.role }
        });

        if (createError) {
            console.error("Error creating user admin:", createError);
            if (createError.message.includes("already registered")) {
                return { success: false, error: "User already exists." };
            }
            return { success: false, error: createError.message };
        }

        const newUserId = userObj?.user?.id;
        if (!newUserId) return { success: false, error: "Failed to create user account." };

        // 2. Link to Organization
        const { error: memberError } = await supabaseAdmin
            .from('organization_members')
            .insert({ org_id: orgId, user_id: newUserId, role: data.role });

        if (memberError) {
            console.error("Error linking member:", memberError);
            return { success: false, error: "User created, but failed to link to organization." };
        }

        // 3. Create Profile
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: newUserId,
                name: data.name,
                email: data.email,
                role: data.role
            });
        
        if (profileError) {
            console.error("Error creating profile:", profileError);
        }

        await logActivity({
            org_id: orgId,
            actor_id: userId,
            type: 'member_joined', // Using 'member_joined' for direct add as well
            description: `Added ${data.email} (${data.name}) directly as ${data.role}`,
            metadata: { email: data.email, name: data.name, role: data.role, newUserId }
        });

        revalidatePath('/dashboard')
        return { success: true };
    } catch (err: any) {
        console.error("Unexpected error in addMemberDirectly:", err);
        return { success: false, error: err.message || "An unexpected error occurred." };
    }
}

export async function acceptInvitation(token: string, name: string, password: string) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Missing Supabase Service Role Key.");
    }

    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Fetch and Validate Token
    const { data: invite, error: fetchError } = await supabaseAdmin
        .from('invitations')
        .select('*')
        .eq('token', token)
        .single();
        
    if (fetchError || !invite) {
        throw new Error("Invalid or expired invitation token.");
    }

    if (new Date(invite.expires_at) < new Date()) {
        throw new Error("This invitation has expired.");
    }

    // 2. Check if user already exists
    const { data: userObj, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: invite.email,
        password: password,
        user_metadata: { name, role: invite.role } // Use the role from the invitation
    });

    const userId = userObj?.user?.id;

    if (createError) {
        if (createError.message.includes("already registered")) {
            throw new Error(`User with email ${invite.email} already exists. Please log in and contact support or ask to be linked manually.`);
        } else {
            throw new Error(createError.message);
        }
    }

    if (!userId) {
        throw new Error("Failed to create user account.");
    }

    // 3. Link user to organization
    const { error: memberError } = await supabaseAdmin
        .from('organization_members')
        .insert({ org_id: invite.org_id, user_id: userId, role: invite.role });

    if (memberError) {
        console.error("Failed to link org member:", memberError);
        throw new Error("User created but failed to link to organization.");
    }

    // 4. Delete the used token
    await supabaseAdmin.from('invitations').delete().eq('id', invite.id);

    // 5. Ensure profile exists for onboarding
    await supabaseAdmin.from('profiles').upsert({
        id: userId,
        name: name,
        role: invite.role // Use the role from the invitation
    });

    await logActivity({
        org_id: invite.org_id,
        actor_id: userId, // The new user is the actor
        type: 'member_joined',
        description: `User ${name} (${invite.email}) accepted invitation and joined as ${invite.role}`,
        metadata: { email: invite.email, name, role: invite.role }
    });

    return { email: invite.email }
}

export async function updateEmployeeProfile(userId: string, name: string, role: string, email?: string) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Missing Supabase Service Role Key.");
    }

    // Admin client to update another user
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Update their Supabase Auth metadata and email if provided
    const updateData: any = { user_metadata: { name, role } };
    if (email) {
        updateData.email = email;
        // Optionally confirm email automatically
        updateData.email_confirm = true;
    }
    
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(userId, updateData);
    if (authError) {
        console.error("Error updating auth user:", authError);
        throw new Error(authError.message);
    }

    // Update the public profiles table
    const { error: profileError } = await supabaseAdmin.from('profiles').update({ name, role }).eq('id', userId)

    if (profileError) {
        console.error("Error updating profile:", profileError);
        throw new Error(profileError.message);
    }

    revalidatePath('/dashboard')
}

export async function updateUserPassword(userId: string, newPassword: string) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Missing Supabase Service Role Key.");
    }

    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Admin API allows password resets without the current password
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });

    if (error) {
        throw new Error(error.message);
    }
}

export async function updateOwnPassword(password: string) {
    await applyRateLimit('updateOwnPassword', 5, 24 * 60 * 60 * 1000);
    if (!validatePasswordStrength(password)) throw new Error("Password does not meet strength requirements (min 8 chars, mixed case, and numbers).");
    
    // Standard authenticated client can change its own password
    const supabase = await createClient()

    const { error } = await supabase.auth.updateUser({
        password: password
    })

    if (error) {
        throw new Error(error.message);
    }
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    try {
        await applyRateLimit('requestPasswordReset', 3, 60 * 60 * 1000); // Strict limit
        if (!validateEmail(email)) return { success: false, error: "Invalid email address format." };
        const sanitizedEmail = email.toLowerCase().trim();
        
        const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/update-password`,
    });

    if (error) {
        await logError("requestPasswordReset", error, { email });
        return { success: false, error: "Failed to send reset email." };
    }
    return { success: true };
    } catch (err: any) {
        console.error("Unexpected error in requestPasswordReset:", err);
        return { success: false, error: err.message || "An unexpected error occurred." };
    }
}

export async function checkRateLimit(ip: string, email?: string): Promise<{ allowed: boolean; waitTime?: number }> {
    const supabase = await createClient();
    const { data: attempts, error } = await supabase
        .from('login_attempts')
        .select('attempted_at')
        .or(`ip_address.eq."${ip}"${email ? `,email.eq."${email}"` : ''}`)
        .gt('attempted_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
        .eq('success', false);

    if (error) {
        console.error("Rate limit check error:", error);
        return { allowed: true }; // Allow if check fails to avoid lockout
    }

    if (attempts && attempts.length >= 5) {
        return { allowed: false, waitTime: 15 }; // Block for 15 minutes
    }

    return { allowed: true };
}

export async function logLoginAttempt(ip: string, email: string, success: boolean) {
    const supabase = await createClient();
    await supabase.from('login_attempts').insert({ ip_address: ip, email, success });
}

export async function updateTaskStatus(taskId: string, status: Status) {
    const { userId, orgId } = await requireOrgContext();
    const supabase = await createClient();
    const { data: task, error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId)
        .eq('org_id', orgId)
        .select()
        .single();

    if (error) {
        console.error("Error updating task status:", error);
        throw new Error(error.message);
    }

    if (task) {
        // Log Activity
        await logActivity({
            org_id: orgId,
            actor_id: userId,
            task_id: taskId,
            type: 'task_status_changed',
            description: `Changed status of "${task.name}" to ${status}`,
            metadata: { from: task.status, to: status, name: task.name }
        });

        // Notify owner
        await createNotification({
            org_id: orgId,
            user_id: task.employee_id,
            type: status === 'Blocked' ? 'urgent' : 'system',
            message: `Task status updated to ${status}: ${task.name}`,
            task_id: task.id
        });

        // Notify other assignees
        if (task.assignee_ids && task.assignee_ids.length > 0) {
            for (const assigneeId of task.assignee_ids) {
                if (assigneeId !== task.employee_id) {
                    await createNotification({
                        org_id: orgId,
                        user_id: assigneeId,
                        type: status === 'Blocked' ? 'urgent' : 'system',
                        message: `Collaborator task status updated to ${status}: ${task.name}`,
                        task_id: task.id
                    });
                }
            }
        }
    }

    // Modal refresh handled by client
}

export async function updateTaskPriority(taskId: string, priority: Priority) {
    const { userId, orgId } = await requireOrgContext();
    const supabase = await createClient();
    const { data: task, error } = await supabase
        .from('tasks')
        .update({ priority })
        .eq('id', taskId)
        .eq('org_id', orgId)
        .select()
        .single();

    if (error) {
        console.error("Error updating task priority:", error);
        throw new Error(error.message);
    }

    if (task) {
        await logActivity({
            org_id: orgId,
            actor_id: userId,
            task_id: task.id,
            type: 'task_priority_changed',
            description: `Changed priority of "${task.name}" to ${priority}`,
            metadata: { name: task.name, priority }
        });
    }

    // Modal refresh handled by client
}

async function recalculateTaskHours(taskId: string) {
    const supabase = await createClient()

    const { data: subtasks, error: subError } = await supabase
        .from('subtasks')
        .select('hours_spent')
        .eq('task_id', taskId)

    if (subError) {
        console.error("Error calculating task hours:", subError)
        return
    }

    const totalHours = subtasks.reduce((sum, s) => sum + (Number(s.hours_spent) || 0), 0)

    const { error: updateError } = await supabase
        .from('tasks')
        .update({ hours_spent: totalHours })
        .eq('id', taskId)

    if (updateError) {
        console.error("Error updating task total hours:", updateError)
    }
    // Background recalculation doesn't need to block UI with a full re-render
}

export async function saveSubtask(subtaskData: Omit<Subtask, 'id' | 'created_at' | 'org_id'>) {
    const { orgId, userId } = await requireOrgContext();
    const supabase = await createClient()

    const { error } = await supabase
        .from('subtasks')
        .insert([{
            ...subtaskData,
            org_id: orgId,
            date_logged: subtaskData.date_logged || new Date().toISOString().split('T')[0]
        }])

    if (error) {
        console.error("Error saving subtask:", error)
        await logError("saveSubtask", error, { subtaskData });
        throw new Error(error.message)
    }

    // Parallelize non-critical background operations
    try {
        await Promise.all([
            logActivity({
                org_id: orgId,
                actor_id: userId,
                task_id: subtaskData.task_id,
                type: 'subtask_created',
                description: `Logged work: ${subtaskData.name} (${subtaskData.hours_spent} hrs)`,
                metadata: { name: subtaskData.name, hours: subtaskData.hours_spent },
                created_at: subtaskData.date_logged ? `${subtaskData.date_logged}T12:00:00Z` : undefined
            }).catch(logErr => console.warn("logActivity failed (non-critical):", logErr)),
            recalculateTaskHours(subtaskData.task_id)
        ]);
    } catch (postSaveErr) {
        console.warn("Post-save background operations had an error (non-critical):", postSaveErr);
        await logError("saveSubtask:postSave", postSaveErr, { subtaskData });
    }
}

export async function updateSubtask(subtaskData: Partial<Omit<Subtask, 'org_id'>> & { id: string, task_id: string }) {
    const { orgId } = await requireOrgContext();
    const supabase = await createClient()

    const { id, task_id, ...updateData } = subtaskData

    const { error } = await supabase
        .from('subtasks')
        .update(updateData)
        .eq('id', id)
        .eq('org_id', orgId)

    if (error) {
        console.error("Error updating subtask:", error)
        await logError("updateSubtask", error, { subtaskData });
        throw new Error(error.message)
    }

    await recalculateTaskHours(task_id)
}

export async function updateSubtaskStatus(subtaskId: string, taskId: string, isCompleted: boolean) {
    const { orgId, userId } = await requireOrgContext();
    const supabase = await createClient()

    const { data: subtask, error } = await supabase
        .from('subtasks')
        .update({ is_completed: isCompleted })
        .eq('id', subtaskId)
        .eq('org_id', orgId)
        .select()
        .single()

    if (error) {
        console.error("Error updating subtask status:", error)
        await logError("updateSubtaskStatus", error, { subtaskId, taskId, isCompleted });
        throw new Error(error.message)
    }

    if (subtask) {
        await logActivity({
            org_id: orgId,
            actor_id: userId,
            task_id: taskId,
            type: 'subtask_completed',
            description: `Subtask "${subtask.name}" marked as ${isCompleted ? 'completed' : 'incomplete'}`,
            metadata: { subtaskName: subtask.name, isCompleted }
        });

        if (isCompleted) {
            // Trigger email notification (fire and forget to not block UI)
            sendSubtaskCompletionEmail(subtaskId, taskId).catch(err => console.error("Email notification failed:", err));
        }
    }

    // Modal refresh handled by client
}

async function sendSubtaskCompletionEmail(subtaskId: string, taskId: string) {
    const supabase = await createClient();
    
    // 1. Fetch Task and all its subtasks
    const { data: task, error: taskError } = await supabase.from('tasks').select('*').eq('id', taskId).single();
    const { data: allSubtasks, error: subError } = await supabase.from('subtasks').select('*').eq('task_id', taskId);
    
    if (taskError || !task || subError) {
        if (taskError) await logError("sendSubtaskCompletionEmail:fetchTask", taskError, { subtaskId, taskId });
        if (subError) await logError("sendSubtaskCompletionEmail:fetchSubtasks", subError, { subtaskId, taskId });
        return;
    }

    // 2. Check if this was the last sub-task
    const completedCount = allSubtasks.filter(s => s.is_completed).length;
    const totalCount = allSubtasks.length;
    const isLastSubtask = completedCount === totalCount;
    const progress = Math.round((completedCount / totalCount) * 100);

    // 3. Fetch Assignee Names and Emails
    const profiles = await getProfiles();
    const owner = profiles.find(p => p.id === task.employee_id);
    const collaborators = profiles.filter(p => task.assignee_ids?.includes(p.id));
    const allAssignees = [owner, ...collaborators].filter((p): p is Profile => !!p);
    
    const recipientEmails = allAssignees.map(p => p.email).filter((e): e is string => !!e);
    if (recipientEmails.length === 0 || !resend) return;

    // 4. Construct Teamwork-style Email
    const currentSubtask = allSubtasks.find(s => s.id === subtaskId);
    const subject = `(Task Management) - System just completed the ${isLastSubtask ? 'last ' : ''}sub-task in "${task.name}" - ${currentSubtask?.name || 'Subtask'}`;
    
    const assigneeNames = allAssignees.map(p => p.name).join(', ');
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}`;

    const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e5ea; border-radius: 16px; overflow: hidden; background-color: #ffffff; color: #1d1d1f;">
            <div style="padding: 12px 24px; background-color: #f5f5f7; border-bottom: 1px solid #e5e5ea; color: #86868b; font-size: 12px; text-align: center;">
                ===== WRITE YOUR REPLY ABOVE THIS LINE =====
            </div>
            
            <div style="padding: 32px 24px;">
                <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600;">System Bot has completed a sub-task you are involved in</p>
                ${isLastSubtask ? '<p style="margin: 0 0 24px 0; font-size: 14px; color: #0071e3; font-weight: 600;">You are now able to complete the parent task</p>' : ''}
                
                <div style="margin-bottom: 32px;">
                    <div style="font-size: 12px; font-weight: 700; color: #86868b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Parent Task</div>
                    <div style="font-size: 20px; font-weight: 800; color: #1d1d1f;">${task.name}</div>
                </div>

                <div style="margin-bottom: 32px; padding: 24px; background-color: #f5f5f7; border-radius: 12px;">
                    <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">Sub-Task Details</h3>
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr>
                            <td style="padding: 6px 0; color: #86868b; width: 120px; font-weight: 600;">Completed</td>
                            <td style="padding: 6px 0; color: #1d1d1f; font-weight: 700;">${currentSubtask?.name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #86868b; font-weight: 600;">Progress</td>
                            <td style="padding: 6px 0;">
                                <span style="color: #0071e3; font-weight: 800;">${progress}%</span>
                                <span style="font-size: 11px; color: #86868b; margin-left: 4px;">(${completedCount}/${totalCount} sub-tasks)</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #86868b; font-weight: 600;">Assigned To</td>
                            <td style="padding: 6px 0; color: #1d1d1f; font-weight: 600;">${assigneeNames}</td>
                        </tr>
                        <tr>
                            <td style="padding: 6px 0; color: #86868b; font-weight: 600;">Priority</td>
                            <td style="padding: 6px 0;"><span style="background-color: ${task.priority === 'Urgent' ? '#ff3b30' : task.priority === 'High' ? '#ff9500' : '#0071e3'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase;">${task.priority}</span></td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 0 6px 0; color: #86868b; font-weight: 600;" colspan="2">Timeline</td>
                        </tr>
                        <tr>
                            <td style="padding: 0 0 12px 0; font-weight: 700; color: #1d1d1f;" colspan="2">${task.start_date} - ${task.deadline}</td>
                        </tr>
                    </table>
                    
                    <a href="${dashboardUrl}" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background-color: #0071e3; color: white; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 700;">View Task in Dashboard</a>
                </div>

                <div style="border-top: 1px solid #e5e5ea; padding-top: 24px; font-size: 12px; color: #86868b; line-height: 1.5;">
                    <div style="font-weight: 700; color: #1d1d1f; margin-bottom: 4px;">Project Details</div>
                    <div>Project: Task Management</div>
                    <div>Company: Mindbird.ai</div>
                </div>
            </div>
            
            <div style="padding: 24px; background-color: #f5f5f7; font-size: 11px; color: #86868b; text-align: center;">
                This is an automated notification from your Task Management System.
            </div>
        </div>
    `;

    try {
        const { error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'TaskHub <onboarding@resend.dev>',
            to: recipientEmails,
            subject: subject,
            html: html
        });
        if (error) {
            console.error("Resend error (subtask completion):", error);
            await logError("sendSubtaskCompletionEmail:resend", error, { subtaskId, taskId, recipientEmails });
        }
    } catch (e) {
        console.error("Error sending subtask completion email:", e);
        await logError("sendSubtaskCompletionEmail:catch", e, { subtaskId, taskId, recipientEmails });
    }
}

export async function updateSubtaskHours(subtaskId: string, taskId: string, hours: number) {
    const { orgId } = await requireOrgContext();
    const supabase = await createClient()

    const { error } = await supabase
        .from('subtasks')
        .update({ hours_spent: hours })
        .eq('id', subtaskId)
        .eq('org_id', orgId)

    if (error) {
        console.error("Error updating subtask hours:", error)
        await logError("updateSubtaskHours", error, { subtaskId, taskId, hours });
        throw new Error(error.message)
    }

    await recalculateTaskHours(taskId)
}

export async function deleteSubtask(subtaskId: string, taskId: string) {
    const { orgId, userId } = await requireOrgContext();
    const supabase = await createClient()

    const { data: subtask, error } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', subtaskId)
        .eq('org_id', orgId)
        .select('name')
        .single();

    if (error) {
        console.error("Error deleting subtask:", error)
        await logError("deleteSubtask", error, { subtaskId, taskId });
        throw new Error(error.message)
    }

    if (subtask) {
        await logActivity({
            org_id: orgId,
            actor_id: userId,
            task_id: taskId,
            type: 'subtask_deleted',
            description: `Deleted subtask: "${subtask.name}"`,
            metadata: { subtaskName: subtask.name }
        });
    }

    await recalculateTaskHours(taskId)
}

export async function updateProfile(userId: string, data: { name: string }) {
    const { userId: currentUserId, orgId } = await requireOrgContext();
    const supabase = await createClient()

    // 1. Verify that BOTH users are in the same organization
    const { data: targetMember, error: memberError } = await supabase
        .from('organization_members')
        .select('org_id')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .single();
    
    if (memberError || !targetMember) {
        await logError("updateProfile:memberCheck", memberError, { targetUserId: userId, orgId, currentUserId });
        throw new Error("Unauthorized: User not in your organization.");
    }

    // 2. Allow self-update OR update by manager
    if (currentUserId !== userId) {
        const { data: currentUserProfile, error: profileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentUserId)
            .single();
        if (profileError || currentUserProfile?.role !== 'manager') {
            await logError("updateProfile:roleCheck", profileError, { targetUserId: userId, orgId, currentUserId, currentRole: currentUserProfile?.role });
            throw new Error("Unauthorized: Only managers can update other profiles.");
        }
    }

    const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', userId)

    if (error) {
        console.error("Error updating profile:", error)
        await logError("updateProfile:update", error, { targetUserId: userId, data });
        throw new Error(error.message)
    }
    revalidatePath('/dashboard')
}

export async function changePassword(newPassword: string) {
    const supabase = await createClient()
    const { error } = await supabase.auth.updateUser({
        password: newPassword
    })

    if (error) {
        console.error("Error changing password:", error)
        await logError("changePassword", error);
        throw new Error(error.message)
    }
}

// Notification Actions
export async function getNotifications(userId: string): Promise<Notification[]> {
    const { orgId } = await requireOrgContext();
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching notifications:", error)
        await logError("getNotifications", error, { userId });
        return []
    }
    return data || []
}

export async function markNotificationAsRead(notificationId: string) {
    const { orgId } = await requireOrgContext();
    const supabase = await createClient()
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('org_id', orgId)
    if (error) {
        await logError("markNotificationAsRead", error, { notificationId });
        throw new Error(error.message)
    }
    revalidatePath('/dashboard')
}

export async function markAllNotificationsAsRead(userId: string) {
    const { orgId } = await requireOrgContext();
    const supabase = await createClient()
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .eq('is_read', false)
    if (error) {
        await logError("markAllNotificationsAsRead", error, { userId });
        throw new Error(error.message)
    }
    revalidatePath('/dashboard')
}

export async function clearNotifications(userId: string) {
    const { orgId } = await requireOrgContext();
    const supabase = await createClient()
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)
        .eq('org_id', orgId)
    if (error) {
        await logError("clearNotifications", error, { userId });
        throw new Error(error.message)
    }
    revalidatePath('/dashboard')
}

export async function deleteTask(taskId: string) {
    const { userId, orgId } = await requireOrgContext();
    const supabase = await createClient()

    // Get task name for logging (scoped to org)
    const { data: task, error: fetchError } = await supabase.from('tasks').select('name').eq('id', taskId).eq('org_id', orgId).single();

    if (fetchError || !task) {
        await logError("deleteTask:fetch", fetchError, { taskId });
        throw new Error("Task not found or unauthorized");
    }

    const { error } = await supabase.from('tasks').delete().eq('id', taskId).eq('org_id', orgId)
    if (error) {
        await logError("deleteTask:delete", error, { taskId });
        throw new Error(error.message)
    }

    await logActivity({
        org_id: orgId,
        actor_id: userId,
        task_id: taskId,
        type: 'task_deleted',
        description: `Deleted task: "${task.name}"`,
        metadata: { name: task.name }
    }).catch(err => console.warn("Delete logging failed:", err));

    revalidatePath('/dashboard')
}

export async function getTaskDetailsData(taskId: string, providedOrgId?: string) {
    let orgId = providedOrgId;
    if (!orgId) {
        const context = await requireOrgContext();
        orgId = context.orgId;
    }
    const supabase = await createClient();

    // Fetch task details
    const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .eq('org_id', orgId)
        .single();

    if (taskError) {
        await logError("getTaskDetailsData:fetchTask", taskError, { taskId, orgId });
        throw new Error("Failed to fetch task details: " + taskError.message);
    }

    // Fetch related data in parallel
    const [subtasks, comments, attachments, activityLogs] = await Promise.all([
        supabase.from('subtasks').select('*').eq('task_id', taskId).order('created_at', { ascending: true }).then(({ data, error }) => {
            if (error) logError("getTaskDetailsData:fetchSubtasks", error, { taskId, orgId });
            return data || [];
        }),
        getComments(taskId, orgId),
        getAttachments(taskId, orgId),
        getActivityLogs(taskId, orgId)
    ]);

    return {
        task,
        subtasks,
        comments,
        attachments,
        activityLogs
    };
}

// --- Logging & Security Helpers ---

export async function logError(context: string, error: any, metadata: any = {}) {
    try {
        const { userId, orgId } = await requireOrgContext().catch(() => ({ userId: 'system', orgId: null }));
        const supabase = await createClient();
        
        console.error(`[ERROR][${context}]`, error);

        await supabase.from('activity_logs').insert([{
            org_id: orgId,
            actor_id: userId === 'system' ? null : userId,
            type: 'system_error' as any,
            description: `Error in ${context}: ${error?.message || 'Unknown error'}`,
            metadata: {
                ...metadata,
                stack: error?.stack,
                timestamp: new Date().toISOString(),
                error_code: error?.code
            }
        }]);

        // Basic "Suspicious Activity" Detection: 
        // If 5+ errors happen for the same user/org in last 10 minutes, log a security event.
        if (userId !== 'system') {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
            const { count } = await supabase
                .from('activity_logs')
                .select('*', { count: 'exact', head: true })
                .eq('actor_id', userId)
                .eq('type', 'system_error')
                .gt('created_at', tenMinutesAgo);

            if (count && count >= 5) {
                await supabase.from('activity_logs').insert([{
                    org_id: orgId,
                    actor_id: userId,
                    type: 'security_event' as any,
                    description: `Suspicious Activity Detected: Multiple (${count}) system errors in 10 minutes.`,
                    metadata: { last_context: context, count }
                }]);
            }
        }
    } catch (e) {
        console.error("Critical: logError failed:", e);
    }
}

export async function logActivity(activity: Omit<ActivityLog, 'id' | 'actor_name' | 'created_at'> & { created_at?: string }) {
    const supabase = await createClient()
    const { error } = await supabase.from('activity_logs').insert([activity])
    if (error) {
        console.error("Error logging activity:", error)
        await logError("logActivity", error, { activity });
    }
}

export async function getActivityLogs(taskId?: string, providedOrgId?: string): Promise<ActivityLog[]> {
    let orgId = providedOrgId;
    if (!orgId) {
        const context = await requireOrgContext();
        orgId = context.orgId;
    }
    const supabase = await createClient()

    let query = supabase
        .from('activity_logs')
        .select('*, profiles:actor_id(name)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

    if (taskId) {
        query = query.eq('task_id', taskId)
    }

    const { data, error } = await query.limit(50)

    if (error) {
        console.error("Error fetching activity logs:", error)
        await logError("getActivityLogs", error, { taskId });
        return []
    }

    return (data || []).map(log => ({
        ...log,
        actor_name: (log as any).profiles?.name || 'Unknown'
    }))
}

export async function createNotification(notificationData: Omit<Notification, 'id' | 'created_at' | 'is_read'>) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('notifications')
        .insert([{ ...notificationData, is_read: false }])

    if (error) {
        console.error("Error creating notification:", error)
        await logError("createNotification", error, { notificationData });
        throw new Error(error.message)
    }

    revalidatePath('/dashboard')
}

export async function getComments(taskId: string, providedOrgId?: string): Promise<Comment[]> {
    let orgId = providedOrgId;
    if (!orgId) {
        const context = await requireOrgContext();
        orgId = context.orgId;
    }
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('comments')
        .select(`
            *,
            profiles:author_id (name)
        `)
        .eq('task_id', taskId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error("Error fetching comments:", error)
        await logError("getComments", error, { taskId });
        return []
    }

    return (data || []).map(c => ({
        ...c,
        author_name: (c as any).profiles?.name || 'Unknown'
    }))
}

export async function saveComment(commentData: Omit<Comment, 'id' | 'created_at' | 'author_name' | 'org_id'>) {
    const { orgId } = await requireOrgContext();
    const supabase = await createClient()

    const { error } = await supabase
        .from('comments')
        .insert([{ ...commentData, org_id: orgId }])

    if (error) {
        console.error("Error saving comment:", error)
        await logError("saveComment:insert", error, { commentData });
        throw new Error(error.message)
    }

    // Notify everyone involved
    const { data: task, error: fetchTaskError } = await supabase
        .from('tasks')
        .select('employee_id, assignee_ids, name')
        .eq('id', commentData.task_id)
        .single();

    if (fetchTaskError) {
        await logError("saveComment:fetchTask", fetchTaskError, { taskId: commentData.task_id });
    }

    if (task) {
        // Need orgId for notification
        const { orgId } = await requireOrgContext();
        const recipients = new Set([task.employee_id, ...(task.assignee_ids || [])]);
        for (const recipientId of recipients) {
            if (recipientId !== commentData.author_id) {
                await createNotification({
                    org_id: orgId,
                    user_id: recipientId,
                    type: 'comment',
                    message: `New comment on task: ${task.name}`,
                    task_id: commentData.task_id
                });
            }
        }
    }

    // Modal refresh handled by client
}

export async function deleteComment(commentId: string) {
    const { orgId } = await requireOrgContext();
    const supabase = await createClient()

    const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('org_id', orgId)

    if (error) {
        console.error("Error deleting comment:", error)
        await logError("deleteComment", error, { commentId });
        throw new Error(error.message)
    }

    // Modal relies on dynamic state refreshes, avoiding full dashboard lock
}

export async function getAttachments(taskId: string, providedOrgId?: string): Promise<Attachment[]> {
    let orgId = providedOrgId;
    if (!orgId) {
        const context = await requireOrgContext();
        orgId = context.orgId;
    }
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('task_id', taskId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error("Error fetching attachments:", error)
        await logError("getAttachments", error, { taskId });
        return []
    }
    return data || []
}

// Helper to keep Attachments type-safe if we add org_id later to type
type AttachmentWithOrg = Attachment & { org_id?: string };

export async function uploadAttachment(formData: FormData): Promise<Attachment> {
    const { orgId, userId } = await requireOrgContext();
    const supabase = await createClient();

    const file = formData.get('file') as File;
    const taskId = formData.get('taskId') as string;

    if (!file) throw new Error("No file found in FormData");
    if (!validateId(taskId)) throw new Error("Invalid Task ID format");

    const fileCheck = checkFileSecurity(file);
    if (!fileCheck.allowed) throw new Error(fileCheck.reason);

    console.log("[uploadAttachment] Starting upload for taskId:", taskId);
    // 1. Verify taskId ownership BEFORE upload
    const { data: taskCheck, error: taskCheckError } = await supabase
        .from('tasks')
        .select('id')
        .eq('id', taskId)
        .eq('org_id', orgId)
        .single();
    
    if (taskCheckError || !taskCheck) {
        await logError("uploadAttachment:taskCheck", taskCheckError, { taskId, orgId, userId });
        throw new Error("Unauthorized: Task not found in your organization.");
    }

    // Use admin client for storage operations (bypasses storage RLS)
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log("[uploadAttachment] Service key present:", !!serviceKey);
    
    if (!serviceKey) {
        await logError("uploadAttachment", new Error("Missing service role key for storage upload"), { taskId, orgId, userId });
        throw new Error("Missing service role key for storage upload");
    }
    const adminClient = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey
    );

    const fileExt = file.name.split('.').pop();
    const fileName = `${taskId}/${Date.now()}-${file.name}`;
    console.log("[uploadAttachment] Generated fileName:", fileName);

    // Upload to Supabase Storage using admin client
    const { data: uploadData, error: uploadError } = await adminClient.storage
        .from('task-attachments')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (uploadError) {
        console.error("[uploadAttachment] Storage upload error:", uploadError);
        await logError("uploadAttachment:storageUpload", uploadError, { taskId, orgId, userId, fileName });
        throw new Error("Failed to upload file: " + uploadError.message);
    }
    console.log("[uploadAttachment] Storage upload success:", uploadData);

    // Get public URL
    const { data: urlData } = adminClient.storage
        .from('task-attachments')
        .getPublicUrl(fileName);
    console.log("[uploadAttachment] Public URL:", urlData.publicUrl);

    // Insert record into attachments table (use regular client for RLS)
    const { data, error } = await supabase
        .from('attachments')
        .insert([{
            task_id: taskId,
            org_id: orgId, // Added for isolation
            uploader_id: userId,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: file.type || `application/${fileExt}`,
            file_size: file.size
        }])
        .select()
        .single();

    if (error) {
        await logError("uploadAttachment:dbInsert", error, { taskId, orgId, userId, fileName });
        // Clean up uploaded file
        await adminClient.storage.from('task-attachments').remove([fileName]);
        throw new Error("Failed to save attachment record: " + error.message);
    }
    console.log("[uploadAttachment] DB insert success:", data);

    // Log activity (non-critical)
    try {
        await logActivity({
            org_id: orgId,
            actor_id: userId,
            task_id: taskId,
            type: 'attachment_added',
            description: `Attached file: ${file.name}`,
            metadata: { file_name: file.name, file_size: file.size }
        });
    } catch (e) {
        console.warn("logActivity for attachment failed (non-critical):", e);
        await logError("uploadAttachment:logActivity", e, { taskId, orgId, userId, fileName });
    }
    // Modal refresh handled by client
    return data;
}

export async function deleteAttachment(attachmentId: string, taskId: string) {
    const { orgId, userId } = await requireOrgContext();
    const supabase = await createClient();

    // Get the attachment to find the storage path
    const { data: attachment, error: fetchError } = await supabase
        .from('attachments')
        .select('*')
        .eq('id', attachmentId)
        .eq('org_id', orgId) // Ensure attachment belongs to org
        .single();

    if (fetchError || !attachment) {
        await logError("deleteAttachment:fetch", fetchError, { attachmentId, taskId, orgId, userId });
        throw new Error("Attachment not found or unauthorized");
    }

    // Use admin client for storage deletion
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
        const adminClient = createSupabaseClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            serviceKey
        );
        // Extract storage path from URL
        const url = new URL(attachment.file_url);
        const pathParts = url.pathname.split('/task-attachments/');
        if (pathParts.length > 1) {
            const storagePath = decodeURIComponent(pathParts[1]);
            const { error: storageError } = await adminClient.storage.from('task-attachments').remove([storagePath]);
            if (storageError) {
                console.error("Error deleting file from storage:", storageError);
                await logError("deleteAttachment:storageDelete", storageError, { attachmentId, taskId, orgId, userId, storagePath });
            }
        }
    } else {
        await logError("deleteAttachment", new Error("Missing service role key for storage deletion"), { attachmentId, taskId, orgId, userId });
    }

    // Delete from DB (scoped to org)
    const { error } = await supabase
        .from('attachments')
        .delete()
        .eq('id', attachmentId)
        .eq('org_id', orgId);

    if (error) {
        console.error("Error deleting attachment:", error);
        await logError("deleteAttachment:dbDelete", error, { attachmentId, taskId, orgId, userId });
        throw new Error("Failed to delete attachment");
    }

    // Modal refresh handled by client
}

export async function getBulkCounts(taskIds: string[]) {
    if (!taskIds.length) return { comments: {}, attachments: {} }
    const { orgId } = await requireOrgContext();
    const supabase = await createClient()

    const [commentsRes, attachmentsRes] = await Promise.all([
        supabase.from('comments').select('task_id').in('task_id', taskIds).eq('org_id', orgId),
        supabase.from('attachments').select('task_id').in('task_id', taskIds).eq('org_id', orgId)
    ])

    const commentCounts: Record<string, number> = {}
    const attachmentCounts: Record<string, number> = {}

    commentsRes.data?.forEach(c => {
        commentCounts[c.task_id] = (commentCounts[c.task_id] || 0) + 1
    })

    attachmentsRes.data?.forEach(a => {
        attachmentCounts[a.task_id] = (attachmentCounts[a.task_id] || 0) + 1
    })

    return { comments: commentCounts, attachments: attachmentCounts }
}

export async function deleteEmployee(userId: string) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!serviceKey) {
        console.error("[DeleteEmployee] Service Role Key is missing.");
        throw new Error("Missing Supabase Service Role Key. Please add SUPABASE_SERVICE_ROLE_KEY to your .env.local file.");
    }

    // Relaxed check to allow both traditional JWT and newer sb_secret_ prefixes
    if (!serviceKey.startsWith('ey') && !serviceKey.startsWith('sb_secret_')) {
        console.error("[DeleteEmployee] Invalid key format. Received:", serviceKey.substring(0, 10) + '...');
        throw new Error("Invalid Service Role Key format. Please check your Supabase Dashboard > Project Settings > API.");
    }

    const { orgId, role: currentRole } = await requireOrgContext();
    if (currentRole !== 'owner' && currentRole !== 'admin' && currentRole !== 'manager') {
        throw new Error("Unauthorized: Only managers/admins can delete employees.");
    }

    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 1. Verify target user is in the same organization
    const { data: targetMember } = await supabaseAdmin
        .from('organization_members')
        .select('org_id')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .single();
    
    if (!targetMember) throw new Error("Unauthorized: User not in your organization.");

    console.log(`[DeleteEmployee] Starting deletion for user: ${userId} in org ${orgId}`);

    try {
        // 1. Cleanup assignee_ids arrays in tasks
        // We fetch tasks where the user is a collaborator and remove them
        const { data: collaboratingTasks, error: fetchError } = await supabaseAdmin
            .from('tasks')
            .select('id, assignee_ids')
            .contains('assignee_ids', [userId]);

        if (fetchError) {
            console.error("[DeleteEmployee] Error fetching collaborating tasks:", fetchError);
        } else if (collaboratingTasks && collaboratingTasks.length > 0) {
            console.log(`[DeleteEmployee] Removing user from ${collaboratingTasks.length} collaborator lists`);
            for (const task of collaboratingTasks) {
                const updatedAssignees = (task.assignee_ids || []).filter((id: string) => id !== userId);
                await supabaseAdmin
                    .from('tasks')
                    .update({ assignee_ids: updatedAssignees })
                    .eq('id', task.id);
            }
        }

        // 2. Delete from Auth
        // This will cascade to profiles, tasks (owned), notifications, and comments via DB constraints
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) {
            await logError("deleteEmployee:auth", authError, { userId });
            throw new Error(`Auth deletion failed: ${authError.message}`);
        }

        console.log(`[DeleteEmployee] Successfully deleted user ${userId}`);
        revalidatePath('/dashboard')
    } catch (error: any) {
        console.error("[DeleteEmployee] Critical error:", error);
        throw error;
    }
}

export async function sendAlert(userId: string | 'all', message: string, type: 'urgent' | 'system' | 'overdue') {
    const { orgId, role: currentRole } = await requireOrgContext();
    if (currentRole !== 'owner' && currentRole !== 'admin' && currentRole !== 'manager') {
        throw new Error("Unauthorized: Only managers/admins can send alerts.");
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Missing Supabase Service Role Key.");
    }

    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    let targets: { id: string, email: string }[] = [];

    if (userId === 'all') {
        // Fetch profiles for all members of this organization
        const { data: profiles, error: profError } = await supabaseAdmin
            .from('organization_members')
            .select('user_id, profiles(email)')
            .eq('org_id', orgId);

        if (profError) throw new Error(profError.message);
        
        targets = (profiles || [])
            .filter(p => (p as any).profiles?.email)
            .map(p => ({
                id: p.user_id,
                email: (p as any).profiles.email
            }));
    } else {
        // Verify target is in same org
        const { data: targetMember } = await supabaseAdmin
            .from('organization_members')
            .select('org_id')
            .eq('user_id', userId)
            .eq('org_id', orgId)
            .single();
        
        if (!targetMember) throw new Error("Unauthorized: Target user not in your organization.");

        const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (userError) throw new Error(userError.message);
        if (user.user?.email) {
            targets = [{ id: user.user.id, email: user.user.email }];
        }
    }

    if (targets.length === 0) return;

    // 1. Insert In-App Notifications
    const notificationData = targets.map(t => ({
        user_id: t.id,
        message: message,
        type: type,
        is_read: false
    }));

    const { error: notifError } = await supabaseAdmin.from('notifications').insert(notificationData);
    if (notifError) console.error("Error creating notifications:", notifError);

    // 2. Send Emails via Resend
    if (resend) {
        try {
            const subject = type === 'urgent' ? `URGENT: Task Management Alert` : `Notification: Task Management System`;
            
            const { error } = await resend.emails.send({
                from: process.env.RESEND_FROM_EMAIL || 'TaskHub <onboarding@resend.dev>',
                to: targets.map(t => t.email),
                subject: subject,
                html: `
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #1d1d1f;">System Alert</h2>
                        <p style="font-size: 16px; color: #424245; line-height: 1.6;">${message}</p>
                        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                        <p style="font-size: 12px; color: #86868b;">This is an automated message from your Task Management Dashboard.</p>
                    </div>
                `
            });
            if (error) console.error("Resend error (bulk notification):", error);
        } catch (emailError) {
            console.error("Error sending emails:", emailError);
        }
    } else {
        console.warn("Resend API Key not found. Email not sent.");
    }

    revalidatePath('/dashboard')
}
export async function getWorkloadHeatmap(projectId?: string, providedOrgId?: string): Promise<WorkloadMap> {
    let orgId = providedOrgId;
    if (!orgId) {
        const context = await requireOrgContext();
        orgId = context.orgId;
    }
    const supabase = await createClient();

    try {
        // 1. Get dates for the current week (Monday to Sunday)
        const now = new Date();
        const startOfWeek = new Date(now);
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
        startOfWeek.setDate(diff);
        startOfWeek.setHours(0, 0, 0, 0);

        const days: string[] = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            days.push(d.toISOString().split('T')[0]);
        }

        // 2. Fetch Profiles/Members
        let profilesQuery = supabase.from('organization_members').select('user_id, profiles(name)').eq('org_id', orgId);
        if (projectId && projectId !== 'all') {
            const { data: projMembers } = await supabase.from('project_members').select('user_id').eq('project_id', projectId);
            const pids = (projMembers || []).map(m => m.user_id);
            profilesQuery = profilesQuery.in('user_id', pids);
        }
        const { data: members, error: mErr } = await profilesQuery;
        if (mErr || !members) return {};
        
        const userIds = members.map(m => m.user_id);
        const todayStr = now.toISOString().split('T')[0];

        // 3. Fetch Subtasks (Historical) and Active Tasks (Future) in parallel
        const [subtasksRes, tasksRes] = await Promise.all([
            supabase.from('subtasks').select('employee_id, date_logged, hours_spent, task_id').in('employee_id', userIds).gte('date_logged', days[0]).lte('date_logged', days[6]),
            supabase.from('tasks').select('id, employee_id, start_date, deadline, priority, status').in('employee_id', userIds).neq('status', 'Completed').filter('deadline', 'gte', days[0]).filter('start_date', 'lte', days[6])
        ]);

        const subtasks = subtasksRes.data || [];
        const activeTasks = tasksRes.data || [];

        // 4. Pre-process subtasks into a Map for O(1) lookup: Map<userId_dayStr, subtask[]>
        const subtasksByMemberAndDay = new Map<string, any[]>();
        subtasks.forEach(s => {
            const key = `${s.employee_id}_${s.date_logged}`;
            if (!subtasksByMemberAndDay.has(key)) subtasksByMemberAndDay.set(key, []);
            subtasksByMemberAndDay.get(key)!.push(s);
        });

        // 5. Pre-process active tasks into a Map for O(1) lookup: Map<userId, task[]>
        const tasksByMember = new Map<string, any[]>();
        activeTasks.forEach(t => {
            if (!tasksByMember.has(t.employee_id)) tasksByMember.set(t.employee_id, []);
            tasksByMember.get(t.employee_id)!.push(t);
        });

        // 6. Build Result Map
        const result: WorkloadMap = {};
        members.forEach(m => {
            const uid = m.user_id;
            const name = (m as any).profiles?.name || 'Unknown';
            result[uid] = { name, days: {} };
            
            const memberTasks = tasksByMember.get(uid) || [];

            days.forEach(dayStr => {
                const sToday = subtasksByMemberAndDay.get(`${uid}_${dayStr}`) || [];
                const hours = sToday.reduce((sum, s) => sum + (Number(s.hours_spent) || 0), 0);
                
                let tasksCount = 0;
                let urgency = 0;

                if (dayStr < todayStr) {
                    tasksCount = new Set(sToday.map(s => s.task_id)).size;
                    urgency = hours > 0 ? 1 : 0;
                } else {
                    const dayTasks = memberTasks.filter(t => {
                        const start = t.start_date?.split('T')[0] || '';
                        const deadline = t.deadline?.split('T')[0] || '';
                        return dayStr >= start && dayStr <= deadline;
                    });
                    tasksCount = dayTasks.length;
                    dayTasks.forEach(t => {
                        let score = 0;
                        if (t.priority === 'Urgent') score += 4;
                        else if (t.priority === 'High') score += 2;
                        else if (t.priority === 'Medium') score += 1;
                        if (t.deadline && t.deadline.split('T')[0] < dayStr) score += 3;
                        urgency += score;
                    });
                }
                result[uid].days[dayStr] = { tasks: tasksCount, hours, urgency };
            });
        });

        return result;
    } catch (err: any) {
        console.error("[getWorkloadHeatmap] TS Aggregate Error:", err);
        return {};
    }
}

export type WorkDetail = {
    task_name: string;
    subtask_name: string;
    hours_spent: number;
    created_at: string;
}

export async function getDailyWorkDetails(userId: string, date: string): Promise<WorkDetail[]> {
    const contextPromise = requireOrgContext();
    const supabase = await createClient();
    
    try {
        const { orgId } = await contextPromise;
        const { data, error } = await supabase
            .from('subtasks')
            .select(`
                name,
                hours_spent,
                created_at,
                tasks (
                    name
                )
            `)
            .eq('employee_id', userId)
            .eq('date_logged', date)
            .eq('org_id', orgId)
            .gt('hours_spent', 0);

        if (error) {
            console.error("[getDailyWorkDetails] Error:", error);
            return [];
        }

        return (data as any[]).map(row => ({
            task_name: row.tasks?.name || 'Unknown Task',
            subtask_name: row.name,
            hours_spent: Number(row.hours_spent) || 0,
            created_at: row.created_at
        }));
    } catch (err) {
        console.error("[getDailyWorkDetails] Catch Error:", err);
        return [];
    }
}

// --- Audit Log Actions ---

export async function getTaskAuditLog(taskId: string): Promise<ActivityLog[]> {
    const { orgId } = await requireOrgContext();
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('activity_logs')
        .select('*, profiles:actor_id(name)')
        .eq('task_id', taskId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching task activity log:", error)
        return []
    }
    
    return (data || []).map(log => ({
        ...log,
        actor_name: (log as any).profiles?.name
    }))
}

export async function getMemberActivity(userId: string, limit = 50): Promise<ActivityLog[]> {
    const { orgId } = await requireOrgContext();
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('activity_logs')
        .select('*, profiles:actor_id(name)')
        .eq('actor_id', userId)
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error("Error fetching member activity:", error)
        return []
    }
    
    return (data || []).map(log => ({
        ...log,
        actor_name: (log as any).profiles?.name
    }))
}

export async function getOrgActivityFeed(orgId: string, limit = 100): Promise<ActivityLog[]> {
    const supabase = await createClient()
    const { data, error } = await supabase
        .from('activity_logs')
        .select('*, profiles:actor_id(name)')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) {
        console.error("Error fetching org activity feed:", error)
        return []
    }
    
    return (data || []).map(log => ({
        ...log,
        actor_name: (log as any).profiles?.name
    }))
}


export async function getDigestPreferences(): Promise<DigestPreferences | null> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('digest_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
}

export async function updateDigestPreferences(prefs: Partial<DigestPreferences>) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Auth required");

    const { error } = await supabase
        .from('digest_preferences')
        .upsert({
            user_id: user.id,
            ...prefs,
            updated_at: new Date().toISOString()
        });

    if (error) throw error;
    return { success: true };
}

export async function syncOverdueTasks() {
    // Disabled: Overdue status is computed dynamically on the client side.
    // Querying and updating every single dashboard load causes row locks, 
    // check constraint violations, and statement timeouts under concurrent usage.
    return { success: true, count: 0 };
}

export async function getDashboardData(projectId?: string, providedOrgId?: string, providedUserId?: string) {
    const startTime = Date.now();
    console.log(`[getDashboardData] Starting fetch for project: ${projectId || 'all'}`);
    const supabase = await createClient()
    
    let orgId = providedOrgId;
    let userId = providedUserId;

    if (!orgId || !userId) {
        const context = await requireOrgContext().catch(() => null);
        if (!context) return null;
        orgId = context.orgId;
        userId = context.userId;
    }

    // 1. Auth Users list is no longer fetched on every load for performance.
    // Rely on profiles table email field instead.
    const authUsersPromise = Promise.resolve([]);

    // 2. Fetch Core Data Promise (Parallel including Auth Users)
    console.time(`[getDashboardData] CoreFetch_${projectId || 'all'}`);
    const [tasks, profiles, projects, projectMembers, logs, workload, authUsers] = await Promise.all([
        getTasks(projectId, orgId),
        authUsersPromise.then(users => getProfiles(undefined, users, orgId)),
        getProjects(orgId),
        authUsersPromise.then(users => projectId ? getProfiles(projectId, users, orgId) : Promise.resolve([])),
        getOrgActivityFeed(orgId || ''),
        getWorkloadHeatmap(projectId, orgId),
        authUsersPromise
    ]);
    console.timeEnd(`[getDashboardData] CoreFetch_${projectId || 'all'}`);

    // 3. Secondary Data (Bulk fetches if tasks exist)
    let subtasks: Subtask[] = [];
    let counts = { comments: {} as Record<string, number>, attachments: {} as Record<string, number> };
    if (tasks.length > 0) {
        console.time(`[getDashboardData] BulkFetch_${tasks.length}_tasks`);
        const ids = tasks.map(t => t.id);
        const [st, c] = await Promise.all([
            getBulkSubtasks(ids),
            getBulkCounts(ids)
        ]);
        subtasks = st;
        counts = c;
        console.timeEnd(`[getDashboardData] BulkFetch_${tasks.length}_tasks`);
    }

    const duration = Date.now() - startTime;
    console.log(`[getDashboardData] Total Duration: ${duration}ms for project ${projectId || 'all'}`);

    return {
        tasks,
        profiles,
        projects,
        projectMembers,
        logs,
        workload,
        subtasks,
        counts
    };
}
