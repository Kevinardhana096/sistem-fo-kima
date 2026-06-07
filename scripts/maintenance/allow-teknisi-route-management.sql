-- Allow role teknisi to manage FO route planner data.
--
-- Context:
-- - Frontend role teknisi can open and operate the FO route planner.
-- - Saving a planned route writes a new customer_route_versions row,
--   customer_route_points rows, and a customer_route_history row.
-- - Older policies only allowed admin to write those route tables, so teknisi
--   could edit in the UI but would fail at commit time.
--
-- This script is idempotent and safe to rerun in Supabase SQL Editor.

-- CUSTOMER_ROUTE_VERSIONS
-- Do not drop existing full/select policies here: some environments still rely on
-- the legacy admin FOR ALL policy for SELECT, while newer environments have
-- separate consolidated read policies. This script only replaces write policies.
DROP POLICY IF EXISTS "Admin insert customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin teknisi insert customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin update customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin teknisi update customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin delete customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin teknisi delete customer_route_versions" ON public.customer_route_versions;

CREATE POLICY "Admin teknisi insert customer_route_versions"
ON public.customer_route_versions
FOR INSERT
WITH CHECK ((select public.get_user_role()) IN ('admin', 'teknisi'));

CREATE POLICY "Admin teknisi update customer_route_versions"
ON public.customer_route_versions
FOR UPDATE
USING ((select public.get_user_role()) IN ('admin', 'teknisi'))
WITH CHECK ((select public.get_user_role()) IN ('admin', 'teknisi'));

CREATE POLICY "Admin teknisi delete customer_route_versions"
ON public.customer_route_versions
FOR DELETE
USING ((select public.get_user_role()) IN ('admin', 'teknisi'));

-- CUSTOMER_ROUTE_POINTS
DROP POLICY IF EXISTS "Admin insert customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin teknisi insert customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin update customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin teknisi update customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin delete customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin teknisi delete customer_route_points" ON public.customer_route_points;

CREATE POLICY "Admin teknisi insert customer_route_points"
ON public.customer_route_points
FOR INSERT
WITH CHECK ((select public.get_user_role()) IN ('admin', 'teknisi'));

CREATE POLICY "Admin teknisi update customer_route_points"
ON public.customer_route_points
FOR UPDATE
USING ((select public.get_user_role()) IN ('admin', 'teknisi'))
WITH CHECK ((select public.get_user_role()) IN ('admin', 'teknisi'));

CREATE POLICY "Admin teknisi delete customer_route_points"
ON public.customer_route_points
FOR DELETE
USING ((select public.get_user_role()) IN ('admin', 'teknisi'));

-- CUSTOMER_ROUTE_HISTORY
DROP POLICY IF EXISTS "Admin insert customer_route_history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Admin teknisi insert customer_route_history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Admin update customer_route_history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Admin teknisi update customer_route_history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Admin delete customer_route_history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Admin teknisi delete customer_route_history" ON public.customer_route_history;

CREATE POLICY "Admin teknisi insert customer_route_history"
ON public.customer_route_history
FOR INSERT
WITH CHECK ((select public.get_user_role()) IN ('admin', 'teknisi'));

CREATE POLICY "Admin teknisi update customer_route_history"
ON public.customer_route_history
FOR UPDATE
USING ((select public.get_user_role()) IN ('admin', 'teknisi'))
WITH CHECK ((select public.get_user_role()) IN ('admin', 'teknisi'));

CREATE POLICY "Admin teknisi delete customer_route_history"
ON public.customer_route_history
FOR DELETE
USING ((select public.get_user_role()) IN ('admin', 'teknisi'));

ANALYZE public.customer_route_versions;
ANALYZE public.customer_route_points;
ANALYZE public.customer_route_history;
