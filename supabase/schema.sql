-- ============================================================
-- MeshForge Database Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Profiles table (mirrors auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  plan TEXT DEFAULT 'free'
    CHECK (plan IN ('free', 'indie', 'studio', 'pro')),
  generations_used INTEGER DEFAULT 0,
  generations_limit INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'background_removal', 'multiview',
      'reconstruction', 'optimising', 'exporting',
      'complete', 'failed'
    )),
  poly_budget TEXT CHECK (poly_budget IN ('low', 'medium', 'high')),
  texture_res INTEGER CHECK (texture_res IN (512, 1024, 2048)),
  format TEXT CHECK (format IN ('GLB', 'OBJ', 'FBX')),
  input_url TEXT,
  output_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- Function: auto-create profile on new user signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: fires after a new user is inserted into auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Function: increment generation count atomically
-- ============================================================
CREATE OR REPLACE FUNCTION increment_generation_count(user_id_input UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET generations_used = generations_used + 1
  WHERE id = user_id_input;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Row Level Security
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Jobs policies
DROP POLICY IF EXISTS "Users can read own jobs" ON jobs;
CREATE POLICY "Users can read own jobs"
  ON jobs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own jobs" ON jobs;
CREATE POLICY "Users can insert own jobs"
  ON jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can update jobs (for backend worker)
DROP POLICY IF EXISTS "Service role can update jobs" ON jobs;
CREATE POLICY "Service role can update jobs"
  ON jobs FOR UPDATE
  USING (true);  -- restricted to service_role key in backend

-- ============================================================
-- Storage: input-images bucket + RLS
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'input-images',
  'input-images',
  true,
  10485760,  -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
DROP POLICY IF EXISTS "Users can upload own images" ON storage.objects;
CREATE POLICY "Users can upload own images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'input-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read of all input images (needed for Modal worker to fetch them)
DROP POLICY IF EXISTS "Public read input images" ON storage.objects;
CREATE POLICY "Public read input images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'input-images');

