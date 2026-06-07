-- Supabase performance optimization, step 4
-- Consolidate core monitoring/billing RLS SELECT policies without changing
-- access semantics. Safe to re-run after RLS helper functions are present.

-- ============================================================================
-- Helper pattern used below:
-- - Admin keeps full read/write access.
-- - Teknisi keeps read-all access.
-- - ISP keeps read-own access.
-- - Admin write access is split into explicit INSERT/UPDATE/DELETE policies so
--   SELECT has a single permissive policy per table.
-- ============================================================================

-- CUSTOMERS
DROP POLICY IF EXISTS "Admin full access on customers" ON public.customers;
DROP POLICY IF EXISTS "Teknisi read all customers" ON public.customers;
DROP POLICY IF EXISTS "ISP read own customers" ON public.customers;
DROP POLICY IF EXISTS "Read customers as admin teknisi or owner isp" ON public.customers;
DROP POLICY IF EXISTS "Admin insert customers" ON public.customers;
DROP POLICY IF EXISTS "Admin update customers" ON public.customers;
DROP POLICY IF EXISTS "Admin delete customers" ON public.customers;

CREATE POLICY "Read customers as admin teknisi or owner isp"
ON public.customers
FOR SELECT
USING (
  (select public.get_user_role()) IN ('admin', 'teknisi')
  OR (
    (select public.get_user_role()) = 'isp'
    AND public.can_current_isp_access_customer(id)
  )
);

CREATE POLICY "Admin insert customers"
ON public.customers
FOR INSERT
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin update customers"
ON public.customers
FOR UPDATE
USING ((select public.get_user_role()) = 'admin')
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin delete customers"
ON public.customers
FOR DELETE
USING ((select public.get_user_role()) = 'admin');

-- CUSTOMER_ISP_MEMBERSHIPS
DROP POLICY IF EXISTS "Admin full access on customer_isp_memberships" ON public.customer_isp_memberships;
DROP POLICY IF EXISTS "Teknisi read all memberships" ON public.customer_isp_memberships;
DROP POLICY IF EXISTS "ISP read own memberships" ON public.customer_isp_memberships;
DROP POLICY IF EXISTS "Read customer_isp_memberships as admin teknisi or owner isp" ON public.customer_isp_memberships;
DROP POLICY IF EXISTS "Admin insert customer_isp_memberships" ON public.customer_isp_memberships;
DROP POLICY IF EXISTS "Admin update customer_isp_memberships" ON public.customer_isp_memberships;
DROP POLICY IF EXISTS "Admin delete customer_isp_memberships" ON public.customer_isp_memberships;

CREATE POLICY "Read customer_isp_memberships as admin teknisi or owner isp"
ON public.customer_isp_memberships
FOR SELECT
USING (
  (select public.get_user_role()) IN ('admin', 'teknisi')
  OR (
    (select public.get_user_role()) = 'isp'
    AND isp_id = (select public.get_current_user_isp_id())
  )
);

CREATE POLICY "Admin insert customer_isp_memberships"
ON public.customer_isp_memberships
FOR INSERT
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin update customer_isp_memberships"
ON public.customer_isp_memberships
FOR UPDATE
USING ((select public.get_user_role()) = 'admin')
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin delete customer_isp_memberships"
ON public.customer_isp_memberships
FOR DELETE
USING ((select public.get_user_role()) = 'admin');

-- CONTRACTS
DROP POLICY IF EXISTS "Admin full access on contracts" ON public.contracts;
DROP POLICY IF EXISTS "Teknisi read all contracts" ON public.contracts;
DROP POLICY IF EXISTS "ISP read own contracts" ON public.contracts;
DROP POLICY IF EXISTS "Read contracts as admin teknisi or owner isp" ON public.contracts;
DROP POLICY IF EXISTS "Admin insert contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admin update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admin delete contracts" ON public.contracts;

CREATE POLICY "Read contracts as admin teknisi or owner isp"
ON public.contracts
FOR SELECT
USING (
  (select public.get_user_role()) IN ('admin', 'teknisi')
  OR (
    (select public.get_user_role()) = 'isp'
    AND public.can_current_isp_access_customer(customer_id)
  )
);

CREATE POLICY "Admin insert contracts"
ON public.contracts
FOR INSERT
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin update contracts"
ON public.contracts
FOR UPDATE
USING ((select public.get_user_role()) = 'admin')
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin delete contracts"
ON public.contracts
FOR DELETE
USING ((select public.get_user_role()) = 'admin');

-- CONTRACT_VERSIONS
DROP POLICY IF EXISTS "Admin full access on contract_versions" ON public.contract_versions;
DROP POLICY IF EXISTS "Teknisi read all contract_versions" ON public.contract_versions;
DROP POLICY IF EXISTS "ISP read own contract_versions" ON public.contract_versions;
DROP POLICY IF EXISTS "Read contract_versions as admin teknisi or owner isp" ON public.contract_versions;
DROP POLICY IF EXISTS "Admin insert contract_versions" ON public.contract_versions;
DROP POLICY IF EXISTS "Admin update contract_versions" ON public.contract_versions;
DROP POLICY IF EXISTS "Admin delete contract_versions" ON public.contract_versions;

CREATE POLICY "Read contract_versions as admin teknisi or owner isp"
ON public.contract_versions
FOR SELECT
USING (
  (select public.get_user_role()) IN ('admin', 'teknisi')
  OR (
    (select public.get_user_role()) = 'isp'
    AND public.can_current_isp_access_customer(customer_id)
  )
);

CREATE POLICY "Admin insert contract_versions"
ON public.contract_versions
FOR INSERT
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin update contract_versions"
ON public.contract_versions
FOR UPDATE
USING ((select public.get_user_role()) = 'admin')
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin delete contract_versions"
ON public.contract_versions
FOR DELETE
USING ((select public.get_user_role()) = 'admin');

-- INVOICES
DROP POLICY IF EXISTS "Admin full access on invoices" ON public.invoices;
DROP POLICY IF EXISTS "Teknisi read all invoices" ON public.invoices;
DROP POLICY IF EXISTS "ISP read own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Read invoices as admin teknisi or owner isp" ON public.invoices;
DROP POLICY IF EXISTS "Admin insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admin update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admin delete invoices" ON public.invoices;

CREATE POLICY "Read invoices as admin teknisi or owner isp"
ON public.invoices
FOR SELECT
USING (
  (select public.get_user_role()) IN ('admin', 'teknisi')
  OR (
    (select public.get_user_role()) = 'isp'
    AND public.can_current_isp_access_customer(customer_id)
  )
);

CREATE POLICY "Admin insert invoices"
ON public.invoices
FOR INSERT
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin update invoices"
ON public.invoices
FOR UPDATE
USING ((select public.get_user_role()) = 'admin')
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin delete invoices"
ON public.invoices
FOR DELETE
USING ((select public.get_user_role()) = 'admin');

-- DOCUMENTS
DROP POLICY IF EXISTS "Admin full access on documents" ON public.documents;
DROP POLICY IF EXISTS "Teknisi read all documents" ON public.documents;
DROP POLICY IF EXISTS "ISP read own documents" ON public.documents;
DROP POLICY IF EXISTS "Read documents as admin teknisi or owner isp" ON public.documents;
DROP POLICY IF EXISTS "Admin insert documents" ON public.documents;
DROP POLICY IF EXISTS "Admin update documents" ON public.documents;
DROP POLICY IF EXISTS "Admin delete documents" ON public.documents;

CREATE POLICY "Read documents as admin teknisi or owner isp"
ON public.documents
FOR SELECT
USING (
  (select public.get_user_role()) IN ('admin', 'teknisi')
  OR (
    (select public.get_user_role()) = 'isp'
    AND public.can_current_isp_access_customer(customer_id)
  )
);

CREATE POLICY "Admin insert documents"
ON public.documents
FOR INSERT
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin update documents"
ON public.documents
FOR UPDATE
USING ((select public.get_user_role()) = 'admin')
WITH CHECK ((select public.get_user_role()) = 'admin');

CREATE POLICY "Admin delete documents"
ON public.documents
FOR DELETE
USING ((select public.get_user_role()) = 'admin');

-- CUSTOMER_ROUTE_VERSIONS
DROP POLICY IF EXISTS "Admin full access on customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin teknisi full access on customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Teknisi read all routes" ON public.customer_route_versions;
DROP POLICY IF EXISTS "ISP read own routes" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Read customer_route_versions as admin teknisi or owner isp" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin insert customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin teknisi insert customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin update customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin teknisi update customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin delete customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin teknisi delete customer_route_versions" ON public.customer_route_versions;

CREATE POLICY "Read customer_route_versions as admin teknisi or owner isp"
ON public.customer_route_versions
FOR SELECT
USING (
  (select public.get_user_role()) IN ('admin', 'teknisi')
  OR (
    (select public.get_user_role()) = 'isp'
    AND public.can_current_isp_access_customer(customer_id)
  )
);

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
DROP POLICY IF EXISTS "Admin full access on customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin teknisi full access on customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Teknisi read all route points" ON public.customer_route_points;
DROP POLICY IF EXISTS "ISP read own route points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Read customer_route_points as admin teknisi or owner isp" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin insert customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin teknisi insert customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin update customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin teknisi update customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin delete customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin teknisi delete customer_route_points" ON public.customer_route_points;

CREATE POLICY "Read customer_route_points as admin teknisi or owner isp"
ON public.customer_route_points
FOR SELECT
USING (
  (select public.get_user_role()) IN ('admin', 'teknisi')
  OR (
    (select public.get_user_role()) = 'isp'
    AND EXISTS (
      SELECT 1
      FROM public.customer_route_versions crv
      WHERE crv.id = customer_route_points.route_version_id
        AND public.can_current_isp_access_customer(crv.customer_id)
    )
  )
);

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

ANALYZE public.customers;
ANALYZE public.customer_isp_memberships;
ANALYZE public.contracts;
ANALYZE public.contract_versions;
ANALYZE public.invoices;
ANALYZE public.documents;
ANALYZE public.customer_route_versions;
ANALYZE public.customer_route_points;
