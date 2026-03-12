"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export type Profile = {
    id: string
    name: string
    role: 'employee' | 'manager'
    email?: string
}

export type Priority = 'Urgent' | 'High' | 'Medium' | 'Low'
export type Status = 'To Do' | 'In Progress' | 'Completed' | 'Blocked'

export type Task = {
    id: string
    employee_id: string // Owner
    assignee_ids?: string[] // Collaborators
    name: string
    start_date: string
    deadline: string
    priority: Priority
    hours_spent: number
    status: Status
    notes: string
    created_at: string
}

export type Subtask = {
    id: string;
    task_id: string;
    employee_id: string; // Contributor
    name: string;
    hours_spent: number;
    is_completed: boolean;
    start_time?: string;
    end_time?: string;
    date_logged?: string;
    created_at: string;
}

export type Comment = {
    id: string;
    task_id: string;
    author_id: string;
    content: string;
    created_at: string;
    author_name?: string;
}

export type Notification = {
    id: string;
    user_id: string;
    type: 'urgent' | 'overdue' | 'comment' | 'system';
    message: string;
    is_read: boolean;
    task_id?: string;
    created_at: string;
}

export async function getProfiles(): Promise<Profile[]> {
    const supabase = await createClient()
    const { data, error } = await supabase.from('profiles').select('*')
    if (error) {
        console.error("Error fetching profiles:", error)
        return []
    }
    return data || []
}

export async function getTasks(): Promise<Task[]> {
    const supabase = await createClient()
    const { data, error } = await supabase.from('tasks').select('*')
    if (error) {
        console.error("Error fetching tasks:", error)
        return []
    }
    return data || []
}

export async function saveTask(taskData: Omit<Task, 'id' | 'created_at'>) {
    const supabase = await createClient()

    const { data: task, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single()

    if (error) {
        console.error("Error saving task:", error)
        throw new Error(error.message)
    }

    if (task) {
        // Notify owner
        await createNotification({
            user_id: task.employee_id,
            type: 'system',
            message: `New task assigned: ${task.name}`,
            task_id: task.id
        });

        // Notify other assignees
        if (task.assignee_ids && task.assignee_ids.length > 0) {
            for (const assigneeId of task.assignee_ids) {
                if (assigneeId !== task.employee_id) {
                    await createNotification({
                        user_id: assigneeId,
                        type: 'system',
                        message: `You were added as a collaborator to: ${task.name}`,
                        task_id: task.id
                    });
                }
            }
        }
    }

    revalidatePath('/')
}

export async function updateTask(taskId: string, taskData: Partial<Omit<Task, 'id' | 'created_at'>>) {
    const supabase = await createClient()

    const { id: _id, created_at: _created_at, ...sanitizedData } = taskData as any;

    const { data: task, error } = await supabase
        .from('tasks')
        .update(sanitizedData)
        .eq('id', taskId)
        .select()
        .single()

    if (error) {
        console.error("Error updating task:", error)
        throw new Error(error.message)
    }

    if (task && taskData.employee_id) {
        await createNotification({
            user_id: task.employee_id,
            type: 'system',
            message: `Task assignment updated: ${task.name}`,
            task_id: task.id
        });
    }

    revalidatePath('/')
}

export async function createEmployeeAccount(name: string, email: string, password: string) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Missing Supabase Service Role Key. Cannot create users.");
    }

    // Import the absolute base client to use the admin role (not the SSR client)
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')

    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    )

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: { name: name, role: 'employee' }
    });

    if (error) {
        throw new Error(error.message);
    }

    // The database trigger we wrote handles inserting the public profile automatically!
    revalidatePath('/')
}

export async function updateEmployeeProfile(userId: string, name: string, role: string) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Missing Supabase Service Role Key.");
    }

    // Admin client to update another user
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Update their Supabase Auth metadata
    await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { name, role } })

    // Update the public profiles table
    const { error } = await supabaseAdmin.from('profiles').update({ name, role }).eq('id', userId)

    if (error) {
        throw new Error(error.message);
    }

    revalidatePath('/')
}

export async function updateUserPassword(userId: string, newPassword: string) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Missing Supabase Service Role Key.");
    }

    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Admin API allows password resets without the current password
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });

    if (error) {
        throw new Error(error.message);
    }
}

export async function updateOwnPassword(newPassword: string) {
    // Standard authenticated client can change its own password
    const supabase = await createClient()

    const { error } = await supabase.auth.updateUser({
        password: newPassword
    })

    if (error) {
        throw new Error(error.message);
    }
}

export async function updateTaskStatus(taskId: string, status: Status) {
    const supabase = await createClient();
    const { data: task, error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId)
        .select()
        .single();

    if (error) {
        throw new Error(error.message);
    }

    if (task) {
        // Notify owner
        await createNotification({
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
                        user_id: assigneeId,
                        type: status === 'Blocked' ? 'urgent' : 'system',
                        message: `Collaborator task status updated to ${status}: ${task.name}`,
                        task_id: task.id
                    });
                }
            }
        }
    }

    revalidatePath('/');
}

export async function deleteTask(taskId: string) {
    const supabase = await createClient();
    const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

    if (error) {
        throw new Error(error.message);
    }
    revalidatePath('/');
}

// Subtask Actions
export async function getSubtasks(taskId: string): Promise<Subtask[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error("Error fetching subtasks:", error)
        return []
    }
    return data || []
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

    revalidatePath('/')
}

export async function saveSubtask(subtaskData: Omit<Subtask, 'id' | 'created_at'>) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('subtasks')
        .insert([{
            ...subtaskData,
            date_logged: subtaskData.date_logged || new Date().toISOString().split('T')[0]
        }])

    if (error) {
        console.error("Error saving subtask:", error)
        throw new Error(error.message)
    }

    await recalculateTaskHours(subtaskData.task_id)
}

export async function updateSubtask(subtaskData: Partial<Subtask> & { id: string, task_id: string }) {
    const supabase = await createClient()

    const { id, task_id, ...updateData } = subtaskData

    const { error } = await supabase
        .from('subtasks')
        .update(updateData)
        .eq('id', id)

    if (error) {
        console.error("Error updating subtask:", error)
        throw new Error(error.message)
    }

    await recalculateTaskHours(task_id)
}

export async function updateSubtaskStatus(subtaskId: string, taskId: string, isCompleted: boolean) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('subtasks')
        .update({ is_completed: isCompleted })
        .eq('id', subtaskId)

    if (error) {
        console.error("Error updating subtask status:", error)
        throw new Error(error.message)
    }

    revalidatePath('/')
}

export async function updateSubtaskHours(subtaskId: string, taskId: string, hours: number) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('subtasks')
        .update({ hours_spent: hours })
        .eq('id', subtaskId)

    if (error) {
        console.error("Error updating subtask hours:", error)
        throw new Error(error.message)
    }

    await recalculateTaskHours(taskId)
}

export async function deleteSubtask(subtaskId: string, taskId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('subtasks')
        .delete()
        .eq('id', subtaskId)

    if (error) {
        console.error("Error deleting subtask:", error)
        throw new Error(error.message)
    }

    await recalculateTaskHours(taskId)
}

export async function updateProfile(userId: string, data: { name: string }) {
    const supabase = await createClient()
    const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('id', userId)

    if (error) {
        console.error("Error updating profile:", error)
        throw new Error(error.message)
    }
    revalidatePath('/')
}

export async function changePassword(newPassword: string) {
    const supabase = await createClient()
    const { error } = await supabase.auth.updateUser({
        password: newPassword
    })

    if (error) {
        console.error("Error changing password:", error)
        throw new Error(error.message)
    }
}

// Notification Actions
export async function getNotifications(userId: string): Promise<Notification[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

    if (error) {
        console.error("Error fetching notifications:", error)
        return []
    }
    return data || []
}

export async function markNotificationAsRead(notificationId: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId)
    if (error) throw new Error(error.message)
    revalidatePath('/')
}

export async function markAllNotificationsAsRead(userId: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
    if (error) throw new Error(error.message)
    revalidatePath('/')
}

export async function clearNotifications(userId: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('notifications').delete().eq('user_id', userId)
    if (error) throw new Error(error.message)
    revalidatePath('/')
}

export async function createNotification(notificationData: Omit<Notification, 'id' | 'created_at' | 'is_read'>) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('notifications')
        .insert([{ ...notificationData, is_read: false }])

    if (error) {
        console.error("Error creating notification:", error)
        throw new Error(error.message)
    }

    revalidatePath('/')
}

export async function getComments(taskId: string): Promise<Comment[]> {
    const supabase = await createClient()

    const { data, error } = await supabase
        .from('comments')
        .select(`
            *,
            profiles:author_id (name)
        `)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })

    if (error) {
        console.error("Error fetching comments:", error)
        return []
    }

    return (data || []).map(c => ({
        ...c,
        author_name: (c as any).profiles?.name || 'Unknown'
    }))
}

export async function saveComment(commentData: Omit<Comment, 'id' | 'created_at' | 'author_name'>) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('comments')
        .insert([commentData])

    if (error) {
        console.error("Error saving comment:", error)
        throw new Error(error.message)
    }

    // Notify everyone involved
    const { data: task } = await supabase
        .from('tasks')
        .select('employee_id, assignee_ids, name')
        .eq('id', commentData.task_id)
        .single();

    if (task) {
        const recipients = new Set([task.employee_id, ...(task.assignee_ids || [])]);
        for (const recipientId of recipients) {
            if (recipientId !== commentData.author_id) {
                await createNotification({
                    user_id: recipientId,
                    type: 'comment',
                    message: `New comment on task: ${task.name}`,
                    task_id: commentData.task_id
                });
            }
        }
    }

    revalidatePath('/')
}

export async function deleteComment(commentId: string) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)

    if (error) {
        console.error("Error deleting comment:", error)
        throw new Error(error.message)
    }

    revalidatePath('/')
}

export async function deleteEmployee(userId: string) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    
    if (!serviceKey) {
        console.error("[DeleteEmployee] Service Role Key is missing.");
        throw new Error("Missing Supabase Service Role Key. Please add SUPABASE_SERVICE_ROLE_KEY to your .env.local file.");
    }

    if (!serviceKey.startsWith('ey')) {
        console.error("[DeleteEmployee] Invalid key format. Expected a JWT starting with 'ey'. Received:", serviceKey.substring(0, 10) + '...');
        throw new Error("Invalid Service Role Key format. The key must be a long JWT string starting with 'ey'. Please check your Supabase Dashboard > Project Settings > API.");
    }

    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    console.log(`[DeleteEmployee] Starting deletion for user: ${userId}`);

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
            console.error("[DeleteEmployee] Auth deletion failed:", authError);
            throw new Error(`Auth deletion failed: ${authError.message}`);
        }

        console.log(`[DeleteEmployee] Successfully deleted user ${userId}`);
        revalidatePath('/')
    } catch (error: any) {
        console.error("[DeleteEmployee] Critical error:", error);
        throw error;
    }
}

export async function sendAlert(userId: string | 'all', message: string, type: 'urgent' | 'system' | 'overdue') {
    if (!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error("Missing Supabase Service Role Key.");
    }

    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    )

    let targets: { id: string, email: string }[] = [];

    if (userId === 'all') {
        const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw new Error(listError.message);
        
        // Fetch profiles to filter only employees
        const { data: profiles } = await supabaseAdmin.from('profiles').select('id').eq('role', 'employee');
        const employeeIds = new Set(profiles?.map(p => p.id) || []);
        
        targets = users.users
            .filter(u => employeeIds.has(u.id))
            .map(u => ({ id: u.id, email: u.email || '' }))
            .filter(t => t.email);
    } else {
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
            
            await resend.emails.send({
                from: 'TaskHub <alerts@resend.dev>', // Note: This is an example, usually needs a verified domain
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
        } catch (emailError) {
            console.error("Error sending emails:", emailError);
        }
    } else {
        console.warn("Resend API Key not found. Email not sent.");
    }

    revalidatePath('/')
}
