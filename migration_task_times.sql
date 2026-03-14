-- Add start_time and end_time to tasks table for precise scheduling
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS end_time TEXT;

-- Update RLS policies is not needed as they already cover all columns for select/insert/update
