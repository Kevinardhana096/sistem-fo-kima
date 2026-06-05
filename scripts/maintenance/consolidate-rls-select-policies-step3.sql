-- Supabase performance optimization, step 3
-- Consolidate selected RLS SELECT policies without changing access semantics.
-- Safe to re-run after the existing RLS helper functions are present.

-- ============================================================================
-- NOTIFICATION_STATES
-- Previous behavior:
-- - Admin can SELECT all rows.
-- - Users can SELECT/INSERT/UPDATE/DELETE their own rows.
-- ============================================================================

DROP POLICY IF EXISTS "Admin read all notification_states" ON public.notification_states;
DROP POLICY IF EXISTS "Users manage own notification_states" ON public.notification_states;
DROP POLICY IF EXISTS "Read notification_states as admin or owner" ON public.notification_states;
DROP POLICY IF EXISTS "Insert own notification_states" ON public.notification_states;
DROP POLICY IF EXISTS "Update own notification_states" ON public.notification_states;
DROP POLICY IF EXISTS "Delete own notification_states" ON public.notification_states;

CREATE POLICY "Read notification_states as admin or owner"
ON public.notification_states
FOR SELECT
USING (
  (select public.get_user_role()) = 'admin'
  OR actor_user_id = (select auth.uid())
);

CREATE POLICY "Insert own notification_states"
ON public.notification_states
FOR INSERT
WITH CHECK (actor_user_id = (select auth.uid()));

CREATE POLICY "Update own notification_states"
ON public.notification_states
FOR UPDATE
USING (actor_user_id = (select auth.uid()))
WITH CHECK (actor_user_id = (select auth.uid()));

CREATE POLICY "Delete own notification_states"
ON public.notification_states
FOR DELETE
USING (actor_user_id = (select auth.uid()));

-- ============================================================================
-- USERS
-- Previous behavior:
-- - Admin can SELECT/INSERT/UPDATE/DELETE all rows.
-- - Authenticated user can SELECT their own row by auth id or email.
-- ============================================================================

DROP POLICY IF EXISTS "Admin full access on users" ON public.users;
DROP POLICY IF EXISTS "Authenticated read own user row" ON public.users;
DROP POLICY IF EXISTS "Read users as admin or owner" ON public.users;
DROP POLICY IF EXISTS "Admin insert users" ON public.users;
DROP POLICY IF EXISTS "Admin update users" ON public.users;
DROP POLICY IF EXISTS "Admin delete users" ON public.users;

CREATE POLICY "Read users as admin or owner"
ON public.users
FOR SELECT
USING (
  (select public.get_user_role()) = 'admin'
  OR (
    (select auth.uid()) IS NOT NULL
    AND (
      id::TEXT = (select auth.uid())::TEXT
      OR email = ((select auth.jwt()) ->> 'email')
    )
  )
);

CREATE POLICY "Admin insert users"
ON public.users
FOR INSERT
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin update users"
ON public.users
FOR UPDATE
USING ((select public.get_user_role()) = 'admin')
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin delete users"
ON public.users
FOR DELETE
USING ((select public.get_user_role()) = 'admin');

-- ============================================================================
-- ISP_USER_ACCOUNTS
-- Previous behavior:
-- - Admin can SELECT/INSERT/UPDATE/DELETE all rows.
-- - ISP can SELECT its own auth mapping.
-- ============================================================================

DROP POLICY IF EXISTS "Admin full access on isp_user_accounts" ON public.isp_user_accounts;
DROP POLICY IF EXISTS "ISP read own account mapping" ON public.isp_user_accounts;
DROP POLICY IF EXISTS "Read isp_user_accounts as admin or owner" ON public.isp_user_accounts;
DROP POLICY IF EXISTS "Admin insert isp_user_accounts" ON public.isp_user_accounts;
DROP POLICY IF EXISTS "Admin update isp_user_accounts" ON public.isp_user_accounts;
DROP POLICY IF EXISTS "Admin delete isp_user_accounts" ON public.isp_user_accounts;

CREATE POLICY "Read isp_user_accounts as admin or owner"
ON public.isp_user_accounts
FOR SELECT
USING (
  (select public.get_user_role()) = 'admin'
  OR (
    (select public.get_user_role()) = 'isp'
    AND auth_user_id = (select auth.uid())
  )
);

CREATE POLICY "Admin insert isp_user_accounts"
ON public.isp_user_accounts
FOR INSERT
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin update isp_user_accounts"
ON public.isp_user_accounts
FOR UPDATE
USING ((select public.get_user_role()) = 'admin')
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin delete isp_user_accounts"
ON public.isp_user_accounts
FOR DELETE
USING ((select public.get_user_role()) = 'admin');

-- ============================================================================
-- ISPS
-- Previous behavior:
-- - Admin can SELECT/INSERT/UPDATE/DELETE all rows.
-- - Teknisi can SELECT all rows.
-- - ISP can SELECT its own ISP row.
-- ============================================================================

DROP POLICY IF EXISTS "Admin full access on isps" ON public.isps;
DROP POLICY IF EXISTS "Teknisi read all isps" ON public.isps;
DROP POLICY IF EXISTS "ISP read own isps" ON public.isps;
DROP POLICY IF EXISTS "Read isps as admin teknisi or owner" ON public.isps;
DROP POLICY IF EXISTS "Admin insert isps" ON public.isps;
DROP POLICY IF EXISTS "Admin update isps" ON public.isps;
DROP POLICY IF EXISTS "Admin delete isps" ON public.isps;

CREATE POLICY "Read isps as admin teknisi or owner"
ON public.isps
FOR SELECT
USING (
  (select public.get_user_role()) IN ('admin', 'teknisi')
  OR (
    (select public.get_user_role()) = 'isp'
    AND id = (select public.get_current_user_isp_id())
  )
);

CREATE POLICY "Admin insert isps"
ON public.isps
FOR INSERT
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin update isps"
ON public.isps
FOR UPDATE
USING ((select public.get_user_role()) = 'admin')
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin delete isps"
ON public.isps
FOR DELETE
USING ((select public.get_user_role()) = 'admin');

ANALYZE public.notification_states;
ANALYZE public.users;
ANALYZE public.isp_user_accounts;
ANALYZE public.isps;
