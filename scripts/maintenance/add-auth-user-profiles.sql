-- Public auth account monitor table.
-- Safe to rerun.
--
-- Supabase Auth stores application role in auth.users.raw_user_meta_data.
-- This table mirrors the small subset needed for account monitoring so admins
-- can query role as a normal column without exposing auth.users directly.

CREATE TABLE IF NOT EXISTS public.auth_user_profiles (
  auth_user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'guest',
  display_name TEXT,
  is_email_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  last_sign_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT auth_user_profiles_role_allowed
    CHECK (role IN ('super_admin', 'admin', 'teknisi', 'isp', 'guest'))
);

CREATE INDEX IF NOT EXISTS idx_auth_user_profiles_role
ON public.auth_user_profiles (role);

CREATE INDEX IF NOT EXISTS idx_auth_user_profiles_email
ON public.auth_user_profiles (email);

CREATE OR REPLACE FUNCTION public.sync_auth_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
BEGIN
  v_role := COALESCE(NULLIF(LOWER(TRIM(NEW.raw_user_meta_data ->> 'role')), ''), 'guest');

  IF v_role NOT IN ('super_admin', 'admin', 'teknisi', 'isp', 'guest') THEN
    v_role := 'guest';
  END IF;

  INSERT INTO public.auth_user_profiles (
    auth_user_id,
    email,
    role,
    display_name,
    is_email_confirmed,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    v_role,
    NULLIF(TRIM(NEW.raw_user_meta_data ->> 'display_name'), ''),
    NEW.email_confirmed_at IS NOT NULL,
    NEW.last_sign_in_at,
    COALESCE(NEW.created_at, NOW()),
    NOW()
  )
  ON CONFLICT (auth_user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name,
    is_email_confirmed = EXCLUDED.is_email_confirmed,
    last_sign_in_at = EXCLUDED.last_sign_in_at,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_auth_user_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_auth_user_profile() FROM anon;
REVOKE ALL ON FUNCTION public.sync_auth_user_profile() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.sync_auth_user_profile() TO service_role;

DROP TRIGGER IF EXISTS sync_auth_user_profile_on_insert ON auth.users;
DROP TRIGGER IF EXISTS sync_auth_user_profile_on_update ON auth.users;

CREATE TRIGGER sync_auth_user_profile_on_insert
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_auth_user_profile();

CREATE TRIGGER sync_auth_user_profile_on_update
AFTER UPDATE OF email, raw_user_meta_data, email_confirmed_at, last_sign_in_at ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_auth_user_profile();

INSERT INTO public.auth_user_profiles (
  auth_user_id,
  email,
  role,
  display_name,
  is_email_confirmed,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  au.id,
  COALESCE(au.email, ''),
  CASE
    WHEN COALESCE(NULLIF(LOWER(TRIM(au.raw_user_meta_data ->> 'role')), ''), 'guest')
      IN ('super_admin', 'admin', 'teknisi', 'isp', 'guest')
      THEN COALESCE(NULLIF(LOWER(TRIM(au.raw_user_meta_data ->> 'role')), ''), 'guest')
    ELSE 'guest'
  END,
  NULLIF(TRIM(au.raw_user_meta_data ->> 'display_name'), ''),
  au.email_confirmed_at IS NOT NULL,
  au.last_sign_in_at,
  COALESCE(au.created_at, NOW()),
  NOW()
FROM auth.users au
ON CONFLICT (auth_user_id) DO UPDATE
SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  display_name = EXCLUDED.display_name,
  is_email_confirmed = EXCLUDED.is_email_confirmed,
  last_sign_in_at = EXCLUDED.last_sign_in_at,
  updated_at = NOW();

ALTER TABLE public.auth_user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read auth_user_profiles" ON public.auth_user_profiles;
DROP POLICY IF EXISTS "Users read own auth_user_profile" ON public.auth_user_profiles;

CREATE POLICY "Admins read auth_user_profiles"
ON public.auth_user_profiles
FOR SELECT
USING (public.get_user_role() IN ('super_admin', 'admin'));

CREATE POLICY "Users read own auth_user_profile"
ON public.auth_user_profiles
FOR SELECT
USING (auth_user_id = (select auth.uid()));

GRANT SELECT ON public.auth_user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_user_profiles TO service_role;

COMMENT ON TABLE public.auth_user_profiles IS
'Mirrors selected Supabase Auth user fields for operational account monitoring.';

COMMENT ON COLUMN public.auth_user_profiles.role IS
'Application role mirrored from auth.users.raw_user_meta_data->>role.';
