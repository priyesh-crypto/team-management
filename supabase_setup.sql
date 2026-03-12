-- ==========================================
-- Task Management System - Database Schema
-- Run this in the Supabase SQL Editor
-- ==========================================

-- 1. Create the `profiles` table to store public user data securely linked to the Auth table
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  name text,
  role text default 'employee' check (role in ('employee', 'manager'))
);

-- Turn on Row Level Security
alter table public.profiles enable row level security;

-- Policies for Profiles
create policy "Public profiles are viewable by everyone." on profiles
  for select using (true);

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

-- 2. Trigger function to automatically create a profile when a new user signs up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role)
  values (new.id, new.raw_user_meta_data->>'name', coalesce(new.raw_user_meta_data->>'role', 'employee'));
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 3. Create the `tasks` table
create table public.tasks (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  start_date date not null,
  deadline date not null,
  priority text check (priority in ('Urgent', 'High', 'Medium', 'Low')),
  hours_spent numeric default 0,
  status text check (status in ('To Do', 'In Progress', 'Completed', 'Blocked')),
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security
alter table public.tasks enable row level security;

-- Policies for Tasks
create policy "Tasks are viewable by everyone." on tasks
  for select using (true);

create policy "Employees can insert their own tasks." on tasks
  for insert with check (auth.uid() = employee_id);

create policy "Employees can update tasks they own or collaborate on." on tasks
  for update using (
    auth.uid() = employee_id OR 
    (assignee_ids IS NOT NULL AND auth.uid() = ANY(assignee_ids))
  );
  
create policy "Managers can insert any tasks." on tasks
  for insert with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'manager'
    )
  );

create policy "Managers can update any tasks." on tasks
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'manager'
    )
  );

create policy "Employees can delete their own tasks." on tasks
  for delete using (auth.uid() = employee_id);

create policy "Managers can delete any tasks." on tasks
  for delete using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'manager'
    )
  );

-- 4. Create the `subtasks` table
create table public.subtasks (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  name text not null,
  hours_spent numeric default 0,
  is_completed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security
alter table public.subtasks enable row level security;

-- Policies for Subtasks
create policy "Subtasks are viewable by everyone." on subtasks
  for select using (true);

create policy "Employees can insert subtasks for their own tasks." on subtasks
  for insert with check (
    exists (
      select 1 from public.tasks
      where id = task_id and employee_id = auth.uid()
    )
  );

create policy "Employees can update subtasks for their own tasks." on subtasks
  for update using (
    exists (
      select 1 from public.tasks
      where id = task_id and employee_id = auth.uid()
    )
  );

create policy "Employees can delete subtasks for their own tasks." on subtasks
  for delete using (
    exists (
      select 1 from public.tasks
      where id = task_id and employee_id = auth.uid()
    )
  );

-- Manager Policies for Subtasks
create policy "Managers can insert any subtasks." on subtasks
  for insert with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'manager'
    )
  );

create policy "Managers can update any subtasks." on subtasks
  for update using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'manager'
    )
  );

create policy "Managers can delete any subtasks." on subtasks
  for delete using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'manager'
    )
  );
-- 5. Create the `notifications` table
create table public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text check (type in ('urgent', 'overdue', 'comment', 'system')) default 'system',
  message text not null,
  is_read boolean default false,
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security
alter table public.notifications enable row level security;

-- Policies for Notifications
create policy "Users can view their own notifications." on notifications
  for select using (auth.uid() = user_id);

create policy "Users can update their own notifications (mark as read)." on notifications
  for update using (auth.uid() = user_id);

create policy "Users can delete their own notifications." on notifications
  for delete using (auth.uid() = user_id);

create policy "Managers can insert notifications for anyone." on notifications
  for insert with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'manager'
    )
  );

-- 6. Create the `comments` table
create table public.comments (
  id uuid default gen_random_uuid() primary key,
  task_id uuid references public.tasks(id) on delete cascade not null,
  author_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security
alter table public.comments enable row level security;

-- Policies for Comments
create policy "Comments are viewable by everyone." on comments
  for select using (true);

create policy "Anyone with access to the task can insert a comment." on comments
  for insert with check (
     exists (
      select 1 from public.profiles
      where id = auth.uid()
    )
  );

create policy "Authors can delete their own comments." on comments
  for delete using (auth.uid() = author_id);
