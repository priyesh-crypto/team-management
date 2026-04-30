-- ==============================================================================
-- Realtime publications for tables the dashboard subscribes to.
-- Without this, postgres_changes events never fire and the notification bell
-- never updates without a manual page refresh.
-- Idempotent: safe to re-run.
-- ==============================================================================

DO $$
DECLARE
    pub_exists boolean;
BEGIN
    SELECT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') INTO pub_exists;
    IF NOT pub_exists THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END$$;

-- Add tables one at a time so a single missing table doesn't break the rest.
DO $$
DECLARE
    tbl text;
    tables text[] := ARRAY[
        'notifications',
        'tasks',
        'subtasks',
        'activity_logs',
        'comments',
        'attachments',
        'task_comments'
    ];
BEGIN
    FOREACH tbl IN ARRAY tables LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables
                   WHERE table_schema = 'public' AND table_name = tbl)
           AND NOT EXISTS (
               SELECT 1 FROM pg_publication_tables
               WHERE pubname = 'supabase_realtime'
                 AND schemaname = 'public'
                 AND tablename = tbl
           )
        THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        END IF;
    END LOOP;
END$$;
