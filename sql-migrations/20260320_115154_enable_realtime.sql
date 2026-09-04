-- Enable real-time for relevant tables in the 'public' schema
-- This allows Supabase to broadcast changes (INSERT, UPDATE, DELETE) to client-side listeners.

-- 1. Enable for tasks
alter publication supabase_realtime add table tasks;

-- 2. Enable for subtasks
alter publication supabase_realtime add table subtasks;

-- 3. Enable for activity_logs (our consolidated log table)
alter publication supabase_realtime add table activity_logs;

-- 4. Enable for notifications
alter publication supabase_realtime add table notifications;

-- 5. Enable for comments
alter publication supabase_realtime add table comments;

-- 6. Enable for attachments
alter publication supabase_realtime add table attachments;

-- 7. Enable for profiles (for role/name changes)
alter publication supabase_realtime add table profiles;

-- Note: If any table is already in the publication, the above commands might throw a notice or error.
-- You can also check current tables with:
-- select * from pg_publication_tables where pubname = 'supabase_realtime';
