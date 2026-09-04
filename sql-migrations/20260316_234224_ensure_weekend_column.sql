-- Ensure send_on_weekends column exists in digest_preferences
ALTER TABLE public.digest_preferences 
ADD COLUMN IF NOT EXISTS send_on_weekends BOOLEAN DEFAULT false;
