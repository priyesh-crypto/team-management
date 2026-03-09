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
