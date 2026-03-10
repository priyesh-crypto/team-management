"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

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
    employee_id: string
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

    const { error } = await supabase
        .from('tasks')
        .insert([taskData])

    if (error) {
        console.error("Error saving task:", error)
        throw new Error(error.message)
    }

    revalidatePath('/')
}

export async function updateTask(taskId: string, taskData: Partial<Omit<Task, 'id' | 'created_at'>>) {
    const supabase = await createClient()

    const { error } = await supabase
        .from('tasks')
        .update(taskData)
        .eq('id', taskId)

    if (error) {
        console.error("Error updating task:", error)
        throw new Error(error.message)
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
    const { error } = await supabase
        .from('tasks')
        .update({ status })
        .eq('id', taskId);

    if (error) {
        throw new Error(error.message);
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
