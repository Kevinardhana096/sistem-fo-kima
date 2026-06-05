-- Supabase performance optimization, step 5
-- Consolidate remaining RLS SELECT policies flagged by the performance advisor.
-- Keeps access semantics unchanged.

-- ============================================================================
-- FOLLOW-UP AND HISTORY TABLES
-- Pattern:
-- - Admin keeps full read/write access.
-- - Teknisi keeps read-all access.
-- - ISP keeps read-own access through the same relation checks as before.
-- ============================================================================

-- INVOICE_FOLLOW_UPS
DROP POLICY IF EXISTS "Admin full access on invoice_follow_ups" ON public.invoice_follow_ups;
DROP POLICY IF EXISTS "Teknisi read all invoice follow ups" ON public.invoice_follow_ups;
DROP POLICY IF EXISTS "ISP read own invoice follow ups" ON public.invoice_follow_ups;
DROP POLICY IF EXISTS "Read invoice_follow_ups as admin teknisi or owner isp" ON public.invoice_follow_ups;
DROP POLICY IF EXISTS "Admin insert invoice_follow_ups" ON public.invoice_follow_ups;
DROP POLICY IF EXISTS "Admin update invoice_follow_ups" ON public.invoice_follow_ups;
DROP POLICY IF EXISTS "Admin delete invoice_follow_ups" ON public.invoice_follow_ups;

CREATE POLICY "Read invoice_follow_ups as admin teknisi or owner isp"
ON public.invoice_follow_ups
FOR SELECT
USING (
  (select public.get_user_role()) IN ('admin', 'teknisi')
  OR (
    (select public.get_user_role()) = 'isp'
    AND EXISTS (
      SELECT 1
      FROM public.invoices i
      WHERE i.id = invoice_follow_ups.invoice_id
        AND public.can_current_isp_access_customer(i.customer_id)
    )
  )
);

CREATE POLICY "Admin insert invoice_follow_ups"
ON public.invoice_follow_ups
FOR INSERT
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin update invoice_follow_ups"
ON public.invoice_follow_ups
FOR UPDATE
USING ((select public.get_user_role()) = 'admin')
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin delete invoice_follow_ups"
ON public.invoice_follow_ups
FOR DELETE
USING ((select public.get_user_role()) = 'admin');

-- CONTRACT_VERSION_RENEWAL_FOLLOW_UPS
DROP POLICY IF EXISTS "Admin full access on contract version renewal follow ups" ON public.contract_version_renewal_follow_ups;
DROP POLICY IF EXISTS "Teknisi read all contract version renewal follow ups" ON public.contract_version_renewal_follow_ups;
DROP POLICY IF EXISTS "ISP read own contract version renewal follow ups" ON public.contract_version_renewal_follow_ups;
DROP POLICY IF EXISTS "Read contract_version_renewal_follow_ups as admin teknisi or owner isp" ON public.contract_version_renewal_follow_ups;
DROP POLICY IF EXISTS "Admin insert contract_version_renewal_follow_ups" ON public.contract_version_renewal_follow_ups;
DROP POLICY IF EXISTS "Admin update contract_version_renewal_follow_ups" ON public.contract_version_renewal_follow_ups;
DROP POLICY IF EXISTS "Admin delete contract_version_renewal_follow_ups" ON public.contract_version_renewal_follow_ups;

CREATE POLICY "Read contract_version_renewal_follow_ups as admin teknisi or owner isp"
ON public.contract_version_renewal_follow_ups
FOR SELECT
USING (
  (select public.get_user_role()) IN ('admin', 'teknisi')
  OR (
    (select public.get_user_role()) = 'isp'
    AND EXISTS (
      SELECT 1
      FROM public.contract_versions cv
      WHERE cv.id = contract_version_renewal_follow_ups.version_id
        AND public.can_current_isp_access_customer(cv.customer_id)
    )
  )
);

CREATE POLICY "Admin insert contract_version_renewal_follow_ups"
ON public.contract_version_renewal_follow_ups
FOR INSERT
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin update contract_version_renewal_follow_ups"
ON public.contract_version_renewal_follow_ups
FOR UPDATE
USING ((select public.get_user_role()) = 'admin')
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin delete contract_version_renewal_follow_ups"
ON public.contract_version_renewal_follow_ups
FOR DELETE
USING ((select public.get_user_role()) = 'admin');

-- ISP_CONTRACT_ROWS
DROP POLICY IF EXISTS "Admin full access on isp_contract_rows" ON public.isp_contract_rows;
DROP POLICY IF EXISTS "Teknisi read all isp contract rows" ON public.isp_contract_rows;
DROP POLICY IF EXISTS "ISP read own isp contract rows" ON public.isp_contract_rows;
DROP POLICY IF EXISTS "Read isp_contract_rows as admin teknisi or owner isp" ON public.isp_contract_rows;
DROP POLICY IF EXISTS "Admin insert isp_contract_rows" ON public.isp_contract_rows;
DROP POLICY IF EXISTS "Admin update isp_contract_rows" ON public.isp_contract_rows;
DROP POLICY IF EXISTS "Admin delete isp_contract_rows" ON public.isp_contract_rows;

CREATE POLICY "Read isp_contract_rows as admin teknisi or owner isp"
ON public.isp_contract_rows
FOR SELECT
USING (
  (select public.get_user_role()) IN ('admin', 'teknisi')
  OR (
    (select public.get_user_role()) = 'isp'
    AND isp_id = (select public.get_current_user_isp_id())
  )
);

CREATE POLICY "Admin insert isp_contract_rows"
ON public.isp_contract_rows
FOR INSERT
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin update isp_contract_rows"
ON public.isp_contract_rows
FOR UPDATE
USING ((select public.get_user_role()) = 'admin')
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin delete isp_contract_rows"
ON public.isp_contract_rows
FOR DELETE
USING ((select public.get_user_role()) = 'admin');

-- ISP_RENEWAL_FOLLOW_UPS
DROP POLICY IF EXISTS "Admin full access on isp_renewal_follow_ups" ON public.isp_renewal_follow_ups;
DROP POLICY IF EXISTS "Teknisi read all renewal follow ups" ON public.isp_renewal_follow_ups;
DROP POLICY IF EXISTS "ISP read own renewal follow ups" ON public.isp_renewal_follow_ups;
DROP POLICY IF EXISTS "Read isp_renewal_follow_ups as admin teknisi or owner isp" ON public.isp_renewal_follow_ups;
DROP POLICY IF EXISTS "Admin insert isp_renewal_follow_ups" ON public.isp_renewal_follow_ups;
DROP POLICY IF EXISTS "Admin update isp_renewal_follow_ups" ON public.isp_renewal_follow_ups;
DROP POLICY IF EXISTS "Admin delete isp_renewal_follow_ups" ON public.isp_renewal_follow_ups;

CREATE POLICY "Read isp_renewal_follow_ups as admin teknisi or owner isp"
ON public.isp_renewal_follow_ups
FOR SELECT
USING (
  (select public.get_user_role()) IN ('admin', 'teknisi')
  OR (
    (select public.get_user_role()) = 'isp'
    AND EXISTS (
      SELECT 1
      FROM public.isp_contract_rows icr
      WHERE icr.id = isp_renewal_follow_ups.row_id
        AND icr.isp_id = (select public.get_current_user_isp_id())
    )
  )
);

CREATE POLICY "Admin insert isp_renewal_follow_ups"
ON public.isp_renewal_follow_ups
FOR INSERT
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin update isp_renewal_follow_ups"
ON public.isp_renewal_follow_ups
FOR UPDATE
USING ((select public.get_user_role()) = 'admin')
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin delete isp_renewal_follow_ups"
ON public.isp_renewal_follow_ups
FOR DELETE
USING ((select public.get_user_role()) = 'admin');

-- CUSTOMER_ROUTE_HISTORY
DROP POLICY IF EXISTS "Admin full access on customer_route_history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Teknisi read all customer route history" ON public.customer_route_history;
DROP POLICY IF EXISTS "ISP read own customer route history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Read customer_route_history as admin teknisi or owner isp" ON public.customer_route_history;
DROP POLICY IF EXISTS "Admin insert customer_route_history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Admin update customer_route_history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Admin delete customer_route_history" ON public.customer_route_history;

CREATE POLICY "Read customer_route_history as admin teknisi or owner isp"
ON public.customer_route_history
FOR SELECT
USING (
  (select public.get_user_role()) IN ('admin', 'teknisi')
  OR (
    (select public.get_user_role()) = 'isp'
    AND public.can_current_isp_access_customer(customer_id)
  )
);

CREATE POLICY "Admin insert customer_route_history"
ON public.customer_route_history
FOR INSERT
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin update customer_route_history"
ON public.customer_route_history
FOR UPDATE
USING ((select public.get_user_role()) = 'admin')
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin delete customer_route_history"
ON public.customer_route_history
FOR DELETE
USING ((select public.get_user_role()) = 'admin');

-- ============================================================================
-- ENTRY POINT TABLES
-- Previous behavior:
-- - Authenticated users could SELECT all rows.
-- - Authenticated users could INSERT/UPDATE/DELETE all rows.
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read ISP entry points" ON public.isp_entry_points;
DROP POLICY IF EXISTS "Authenticated users can manage ISP entry points" ON public.isp_entry_points;
DROP POLICY IF EXISTS "Authenticated users can read isp_entry_points" ON public.isp_entry_points;
DROP POLICY IF EXISTS "Authenticated users can insert isp_entry_points" ON public.isp_entry_points;
DROP POLICY IF EXISTS "Authenticated users can update isp_entry_points" ON public.isp_entry_points;
DROP POLICY IF EXISTS "Authenticated users can delete isp_entry_points" ON public.isp_entry_points;

CREATE POLICY "Authenticated users can read isp_entry_points"
ON public.isp_entry_points
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert isp_entry_points"
ON public.isp_entry_points
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update isp_entry_points"
ON public.isp_entry_points
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete isp_entry_points"
ON public.isp_entry_points
FOR DELETE
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can read customer ISP entry points" ON public.customer_isp_entry_points;
DROP POLICY IF EXISTS "Authenticated users can manage customer ISP entry points" ON public.customer_isp_entry_points;
DROP POLICY IF EXISTS "Authenticated users can read customer_isp_entry_points" ON public.customer_isp_entry_points;
DROP POLICY IF EXISTS "Authenticated users can insert customer_isp_entry_points" ON public.customer_isp_entry_points;
DROP POLICY IF EXISTS "Authenticated users can update customer_isp_entry_points" ON public.customer_isp_entry_points;
DROP POLICY IF EXISTS "Authenticated users can delete customer_isp_entry_points" ON public.customer_isp_entry_points;

CREATE POLICY "Authenticated users can read customer_isp_entry_points"
ON public.customer_isp_entry_points
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert customer_isp_entry_points"
ON public.customer_isp_entry_points
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update customer_isp_entry_points"
ON public.customer_isp_entry_points
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete customer_isp_entry_points"
ON public.customer_isp_entry_points
FOR DELETE
TO authenticated
USING (true);

ANALYZE public.invoice_follow_ups;
ANALYZE public.contract_version_renewal_follow_ups;
ANALYZE public.isp_contract_rows;
ANALYZE public.isp_renewal_follow_ups;
ANALYZE public.customer_route_history;
ANALYZE public.isp_entry_points;
ANALYZE public.customer_isp_entry_points;
