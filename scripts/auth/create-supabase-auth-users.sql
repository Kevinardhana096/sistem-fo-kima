-- Create Supabase Auth Users
-- Run this in Supabase SQL Editor
--
-- SECURITY: This is a TEMPLATE. Replace every REPLACE_WITH_* placeholder with a
-- strong, unique password BEFORE running, and do NOT commit the filled-in values.
-- Use a dedicated DEV Supabase project for test accounts; never reuse production
-- passwords. Rotate any password that has ever been committed or shared.

-- Note: Supabase Auth users are created in auth.users table
-- Password will be hashed automatically by Supabase
-- User metadata stores the role information
-- Untuk role ISP, jalankan scripts/auth/map-isp-users.sql agar akun ISP terhubung
-- ke tepat satu ISP di public.isp_user_accounts.

-- 1. Admin User
-- Email: admin@kima.local
-- Role: admin

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@kima.local',
  crypt('REPLACE_WITH_ADMIN_PASSWORD', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"role":"admin","display_name":"Administrator"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1
  FROM auth.users
  WHERE email = 'admin@kima.local'
);

-- 2. Teknisi User
-- Email: teknisi@kima.local
-- Role: teknisi

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'teknisi@kima.local',
  crypt('REPLACE_WITH_TEKNISI_PASSWORD', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"role":"teknisi","display_name":"Teknisi"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1
  FROM auth.users
  WHERE email = 'teknisi@kima.local'
);

-- 3. ISP User
-- Email: isp@kima.local
-- Role: isp

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'isp@kima.local',
  crypt('REPLACE_WITH_ISP_PASSWORD', gen_salt('bf')),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"role":"isp","display_name":"ISP User"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
WHERE NOT EXISTS (
  SELECT 1
  FROM auth.users
  WHERE email = 'isp@kima.local'
);

-- Verify users created
SELECT
  id,
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'display_name' as display_name,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email IN ('admin@kima.local', 'teknisi@kima.local', 'isp@kima.local')
ORDER BY email;
