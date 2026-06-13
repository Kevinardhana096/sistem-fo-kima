-- Promote selected existing Supabase Auth admin users to super_admin.
--
-- Usage:
-- 1. Review the current admins with the SELECT below.
-- 2. Replace the email array in selected_admin_emails with the exact admin emails
--    that must keep full operational notification coverage.
-- 3. Run this script in Supabase SQL Editor with an owner/service-role context.
--
-- Safety:
-- - The default array is empty, so the UPDATE is a no-op until you explicitly add emails.
-- - Only users whose current raw_user_meta_data.role is 'admin' are promoted.
-- - The previous metadata is preserved under previous_role_before_super_admin_migration.

BEGIN;

-- Preview current admin accounts before editing selected_admin_emails.
SELECT
  id,
  email,
  raw_user_meta_data ->> 'role' AS current_role,
  raw_user_meta_data ->> 'display_name' AS display_name,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE raw_user_meta_data ->> 'role' = 'admin'
ORDER BY email;

WITH selected_admin_emails(email) AS (
  SELECT unnest(ARRAY[
    -- TODO: replace with reviewed admin emails, for example:
    -- 'admin@kima.co.id'
  ]::text[])
), promoted AS (
  UPDATE auth.users AS users
  SET raw_user_meta_data = jsonb_set(
        jsonb_set(
          COALESCE(users.raw_user_meta_data, '{}'::jsonb),
          '{previous_role_before_super_admin_migration}',
          to_jsonb(users.raw_user_meta_data ->> 'role'),
          true
        ),
        '{role}',
        '"super_admin"'::jsonb,
        true
      ),
      updated_at = NOW()
  FROM selected_admin_emails selected
  WHERE lower(users.email) = lower(selected.email)
    AND users.raw_user_meta_data ->> 'role' = 'admin'
  RETURNING users.id, users.email, users.raw_user_meta_data ->> 'role' AS new_role
)
SELECT * FROM promoted ORDER BY email;

COMMIT;
