-- ==============================================================
-- DATABASE MIGRATION SCRIPT FOR NEW SUPABASE (Dalilek)
-- ==============================================================
-- Run this entire script in the SQL Editor of your NEW Supabase project.
-- It will create all the necessary tables for Auth, Profiles, Ratings, etc.

-- 1. Create Profiles Table (Linked to Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  avatar_url text,
  role text default 'user',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Saved Articles Table
CREATE TABLE IF NOT EXISTS public.saved_articles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  article_id uuid references public.articles on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, article_id)
);

-- 3. Create Reading History Table
CREATE TABLE IF NOT EXISTS public.reading_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  article_id uuid references public.articles on delete cascade not null,
  last_read_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, article_id)
);

-- 4. Create Contact Messages Table
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid default gen_random_uuid() primary key,
  name text,
  email text,
  subject text,
  message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Create Newsletter Subscriptions Table
CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Turn OFF Row Level Security (RLS) to ensure everything works immediately
-- (We are disabling RLS to prevent "permission denied" errors after migration)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscriptions DISABLE ROW LEVEL SECURITY;

-- 7. (Optional but recommended) Create a trigger to auto-create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists to avoid errors, then recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Done!
