-- Migration: Add email to profiles and update trigger
-- Run this in the Supabase SQL Editor (https://app.supabase.com/project/_/sql)

-- 1. Add email column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Update the handle_new_user function to sync email
OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, email)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'name', 
    COALESCE(new.raw_user_meta_data->>'role', 'employee'),
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill existing emails (This requires service role access usually, so we do it via SQL)
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id;
