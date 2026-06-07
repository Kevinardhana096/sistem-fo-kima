-- Setup Row Level Security (RLS) Policies for Supabase
-- Run this in Supabase SQL Editor after creating auth users

-- ============================================================================
-- HELPER FUNCTION: Get user role from JWT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role')::TEXT,
    'guest'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- ISP ACCOUNT MAPPING (1 akun ISP = 1 entitas ISP)
-- ============================================================================
-- Mapping ini menghubungkan auth.users.id (UUID) ke public.isps.id (BIGINT)
-- dengan constraint 1:1:
-- - 1 auth user hanya boleh ke 1 ISP
-- - 1 ISP hanya boleh punya 1 auth user

CREATE TABLE IF NOT EXISTS public.isp_user_accounts (
  id BIGSERIAL PRIMARY KEY,
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  isp_id BIGINT NOT NULL UNIQUE REFERENCES public.isps(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.isp_user_accounts
  ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.isp_user_accounts
  ADD COLUMN IF NOT EXISTS display_name TEXT;

CREATE INDEX IF NOT EXISTS idx_isp_user_accounts_auth_user_id
ON public.isp_user_accounts (auth_user_id);

CREATE INDEX IF NOT EXISTS idx_isp_user_accounts_isp_id
ON public.isp_user_accounts (isp_id);

CREATE OR REPLACE FUNCTION public.get_current_user_isp_id()
RETURNS BIGINT AS $$
  SELECT iua.isp_id
  FROM public.isp_user_accounts iua
  WHERE iua.auth_user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.can_current_isp_access_customer(target_customer_id BIGINT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.customer_isp_memberships cim
    WHERE cim.customer_id = target_customer_id
      AND cim.isp_id = public.get_current_user_isp_id()
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================================
-- ISP_USER_ACCOUNTS TABLE RLS
-- ============================================================================

ALTER TABLE public.isp_user_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on isp_user_accounts" ON public.isp_user_accounts;
DROP POLICY IF EXISTS "ISP read own account mapping" ON public.isp_user_accounts;

CREATE POLICY "Admin full access on isp_user_accounts"
ON public.isp_user_accounts
FOR ALL
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "ISP read own account mapping"
ON public.isp_user_accounts
FOR SELECT
USING (
  public.get_user_role() = 'isp'
  AND auth_user_id = auth.uid()
);

-- ============================================================================
-- CUSTOMERS TABLE
-- ============================================================================

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on customers" ON public.customers;
DROP POLICY IF EXISTS "Teknisi read all customers" ON public.customers;
DROP POLICY IF EXISTS "ISP read all customers" ON public.customers;
DROP POLICY IF EXISTS "ISP read own customers" ON public.customers;

CREATE POLICY "Admin full access on customers"
ON public.customers
FOR ALL
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Teknisi read all customers"
ON public.customers
FOR SELECT
USING (public.get_user_role() = 'teknisi');

CREATE POLICY "ISP read own customers"
ON public.customers
FOR SELECT
USING (
  public.get_user_role() = 'isp'
  AND public.can_current_isp_access_customer(id)
);

-- ============================================================================
-- ISPS TABLE
-- ============================================================================

ALTER TABLE public.isps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on isps" ON public.isps;
DROP POLICY IF EXISTS "Teknisi read all isps" ON public.isps;
DROP POLICY IF EXISTS "ISP read all isps" ON public.isps;
DROP POLICY IF EXISTS "ISP read own isps" ON public.isps;

CREATE POLICY "Admin full access on isps"
ON public.isps
FOR ALL
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Teknisi read all isps"
ON public.isps
FOR SELECT
USING (public.get_user_role() = 'teknisi');

CREATE POLICY "ISP read own isps"
ON public.isps
FOR SELECT
USING (
  public.get_user_role() = 'isp'
  AND id = public.get_current_user_isp_id()
);

-- ============================================================================
-- CUSTOMER_ISP_MEMBERSHIPS TABLE
-- ============================================================================

ALTER TABLE public.customer_isp_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on customer_isp_memberships" ON public.customer_isp_memberships;
DROP POLICY IF EXISTS "Teknisi read all memberships" ON public.customer_isp_memberships;
DROP POLICY IF EXISTS "ISP read all memberships" ON public.customer_isp_memberships;
DROP POLICY IF EXISTS "ISP read own memberships" ON public.customer_isp_memberships;

CREATE POLICY "Admin full access on customer_isp_memberships"
ON public.customer_isp_memberships
FOR ALL
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Teknisi read all memberships"
ON public.customer_isp_memberships
FOR SELECT
USING (public.get_user_role() = 'teknisi');

CREATE POLICY "ISP read own memberships"
ON public.customer_isp_memberships
FOR SELECT
USING (
  public.get_user_role() = 'isp'
  AND isp_id = public.get_current_user_isp_id()
);

-- ============================================================================
-- CONTRACTS TABLE
-- ============================================================================

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on contracts" ON public.contracts;
DROP POLICY IF EXISTS "Teknisi read all contracts" ON public.contracts;
DROP POLICY IF EXISTS "ISP read all contracts" ON public.contracts;
DROP POLICY IF EXISTS "ISP read own contracts" ON public.contracts;

CREATE POLICY "Admin full access on contracts"
ON public.contracts
FOR ALL
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Teknisi read all contracts"
ON public.contracts
FOR SELECT
USING (public.get_user_role() = 'teknisi');

CREATE POLICY "ISP read own contracts"
ON public.contracts
FOR SELECT
USING (
  public.get_user_role() = 'isp'
  AND public.can_current_isp_access_customer(customer_id)
);

-- ============================================================================
-- CONTRACT_VERSIONS TABLE
-- ============================================================================

ALTER TABLE public.contract_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on contract_versions" ON public.contract_versions;
DROP POLICY IF EXISTS "Teknisi read all contract_versions" ON public.contract_versions;
DROP POLICY IF EXISTS "ISP read all contract_versions" ON public.contract_versions;
DROP POLICY IF EXISTS "ISP read own contract_versions" ON public.contract_versions;

CREATE POLICY "Admin full access on contract_versions"
ON public.contract_versions
FOR ALL
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Teknisi read all contract_versions"
ON public.contract_versions
FOR SELECT
USING (public.get_user_role() = 'teknisi');

CREATE POLICY "ISP read own contract_versions"
ON public.contract_versions
FOR SELECT
USING (
  public.get_user_role() = 'isp'
  AND public.can_current_isp_access_customer(customer_id)
);

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on invoices" ON public.invoices;
DROP POLICY IF EXISTS "Teknisi read all invoices" ON public.invoices;
DROP POLICY IF EXISTS "ISP read all invoices" ON public.invoices;
DROP POLICY IF EXISTS "ISP read own invoices" ON public.invoices;

CREATE POLICY "Admin full access on invoices"
ON public.invoices
FOR ALL
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Teknisi read all invoices"
ON public.invoices
FOR SELECT
USING (public.get_user_role() = 'teknisi');

CREATE POLICY "ISP read own invoices"
ON public.invoices
FOR SELECT
USING (
  public.get_user_role() = 'isp'
  AND public.can_current_isp_access_customer(customer_id)
);

-- ============================================================================
-- DOCUMENTS TABLE
-- ============================================================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on documents" ON public.documents;
DROP POLICY IF EXISTS "Teknisi read all documents" ON public.documents;
DROP POLICY IF EXISTS "ISP read all documents" ON public.documents;
DROP POLICY IF EXISTS "ISP read own documents" ON public.documents;

CREATE POLICY "Admin full access on documents"
ON public.documents
FOR ALL
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Teknisi read all documents"
ON public.documents
FOR SELECT
USING (public.get_user_role() = 'teknisi');

CREATE POLICY "ISP read own documents"
ON public.documents
FOR SELECT
USING (
  public.get_user_role() = 'isp'
  AND public.can_current_isp_access_customer(customer_id)
);

-- ============================================================================
-- CUSTOMER_ROUTE_VERSIONS TABLE
-- ============================================================================

ALTER TABLE public.customer_route_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin teknisi full access on customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Teknisi read all routes" ON public.customer_route_versions;
DROP POLICY IF EXISTS "ISP read all routes" ON public.customer_route_versions;
DROP POLICY IF EXISTS "ISP read own routes" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin insert customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin teknisi insert customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin update customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin teknisi update customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin delete customer_route_versions" ON public.customer_route_versions;
DROP POLICY IF EXISTS "Admin teknisi delete customer_route_versions" ON public.customer_route_versions;

CREATE POLICY "Admin teknisi full access on customer_route_versions"
ON public.customer_route_versions
FOR ALL
USING (public.get_user_role() IN ('admin', 'teknisi'))
WITH CHECK (public.get_user_role() IN ('admin', 'teknisi'));

CREATE POLICY "ISP read own routes"
ON public.customer_route_versions
FOR SELECT
USING (
  public.get_user_role() = 'isp'
  AND public.can_current_isp_access_customer(customer_id)
);

-- ============================================================================
-- CUSTOMER_ROUTE_POINTS TABLE
-- ============================================================================

ALTER TABLE public.customer_route_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin teknisi full access on customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Teknisi read all route points" ON public.customer_route_points;
DROP POLICY IF EXISTS "ISP read all route points" ON public.customer_route_points;
DROP POLICY IF EXISTS "ISP read own route points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin insert customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin teknisi insert customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin update customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin teknisi update customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin delete customer_route_points" ON public.customer_route_points;
DROP POLICY IF EXISTS "Admin teknisi delete customer_route_points" ON public.customer_route_points;

CREATE POLICY "Admin teknisi full access on customer_route_points"
ON public.customer_route_points
FOR ALL
USING (public.get_user_role() IN ('admin', 'teknisi'))
WITH CHECK (public.get_user_role() IN ('admin', 'teknisi'));

CREATE POLICY "ISP read own route points"
ON public.customer_route_points
FOR SELECT
USING (
  public.get_user_role() = 'isp'
  AND EXISTS (
    SELECT 1
    FROM public.customer_route_versions crv
    WHERE crv.id = customer_route_points.route_version_id
      AND public.can_current_isp_access_customer(crv.customer_id)
  )
);

-- ============================================================================
-- ISP_CONTRACT_ROWS TABLE
-- ============================================================================

ALTER TABLE public.isp_contract_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on isp_contract_rows" ON public.isp_contract_rows;
DROP POLICY IF EXISTS "Teknisi read all isp contract rows" ON public.isp_contract_rows;
DROP POLICY IF EXISTS "ISP read all isp contract rows" ON public.isp_contract_rows;
DROP POLICY IF EXISTS "ISP read own isp contract rows" ON public.isp_contract_rows;

CREATE POLICY "Admin full access on isp_contract_rows"
ON public.isp_contract_rows
FOR ALL
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Teknisi read all isp contract rows"
ON public.isp_contract_rows
FOR SELECT
USING (public.get_user_role() = 'teknisi');

CREATE POLICY "ISP read own isp contract rows"
ON public.isp_contract_rows
FOR SELECT
USING (
  public.get_user_role() = 'isp'
  AND isp_id = public.get_current_user_isp_id()
);

-- ============================================================================
-- ISP_RENEWAL_FOLLOW_UPS TABLE
-- ============================================================================

ALTER TABLE public.isp_renewal_follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on isp_renewal_follow_ups" ON public.isp_renewal_follow_ups;
DROP POLICY IF EXISTS "Teknisi read all renewal follow ups" ON public.isp_renewal_follow_ups;
DROP POLICY IF EXISTS "ISP read all renewal follow ups" ON public.isp_renewal_follow_ups;
DROP POLICY IF EXISTS "ISP read own renewal follow ups" ON public.isp_renewal_follow_ups;

CREATE POLICY "Admin full access on isp_renewal_follow_ups"
ON public.isp_renewal_follow_ups
FOR ALL
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Teknisi read all renewal follow ups"
ON public.isp_renewal_follow_ups
FOR SELECT
USING (public.get_user_role() = 'teknisi');

CREATE POLICY "ISP read own renewal follow ups"
ON public.isp_renewal_follow_ups
FOR SELECT
USING (
  public.get_user_role() = 'isp'
  AND EXISTS (
    SELECT 1
    FROM public.isp_contract_rows icr
    WHERE icr.id = isp_renewal_follow_ups.row_id
      AND icr.isp_id = public.get_current_user_isp_id()
  )
);

-- ============================================================================
-- LEGACY USERS TABLE
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on users" ON public.users;
DROP POLICY IF EXISTS "Authenticated read own user row" ON public.users;

CREATE POLICY "Admin full access on users"
ON public.users
FOR ALL
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Authenticated read own user row"
ON public.users
FOR SELECT
USING (
  auth.uid() IS NOT NULL
  AND (id::TEXT = auth.uid()::TEXT OR email = auth.jwt() ->> 'email')
);

-- ============================================================================
-- INVOICE_FOLLOW_UPS TABLE
-- ============================================================================

ALTER TABLE public.invoice_follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on invoice_follow_ups" ON public.invoice_follow_ups;
DROP POLICY IF EXISTS "Teknisi read all invoice follow ups" ON public.invoice_follow_ups;
DROP POLICY IF EXISTS "ISP read own invoice follow ups" ON public.invoice_follow_ups;

CREATE POLICY "Admin full access on invoice_follow_ups"
ON public.invoice_follow_ups
FOR ALL
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Teknisi read all invoice follow ups"
ON public.invoice_follow_ups
FOR SELECT
USING (public.get_user_role() = 'teknisi');

CREATE POLICY "ISP read own invoice follow ups"
ON public.invoice_follow_ups
FOR SELECT
USING (
  public.get_user_role() = 'isp'
  AND EXISTS (
    SELECT 1
    FROM public.invoices i
    WHERE i.id = invoice_follow_ups.invoice_id
      AND public.can_current_isp_access_customer(i.customer_id)
  )
);

-- ============================================================================
-- CONTRACT_VERSION_RENEWAL_FOLLOW_UPS TABLE
-- ============================================================================

ALTER TABLE public.contract_version_renewal_follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on contract version renewal follow ups" ON public.contract_version_renewal_follow_ups;
DROP POLICY IF EXISTS "Teknisi read all contract version renewal follow ups" ON public.contract_version_renewal_follow_ups;
DROP POLICY IF EXISTS "ISP read own contract version renewal follow ups" ON public.contract_version_renewal_follow_ups;

CREATE POLICY "Admin full access on contract version renewal follow ups"
ON public.contract_version_renewal_follow_ups
FOR ALL
USING (public.get_user_role() = 'admin')
WITH CHECK (public.get_user_role() = 'admin');

CREATE POLICY "Teknisi read all contract version renewal follow ups"
ON public.contract_version_renewal_follow_ups
FOR SELECT
USING (public.get_user_role() = 'teknisi');

CREATE POLICY "ISP read own contract version renewal follow ups"
ON public.contract_version_renewal_follow_ups
FOR SELECT
USING (
  public.get_user_role() = 'isp'
  AND EXISTS (
    SELECT 1
    FROM public.contract_versions cv
    WHERE cv.id = contract_version_renewal_follow_ups.version_id
      AND public.can_current_isp_access_customer(cv.customer_id)
  )
);

-- ============================================================================
-- CUSTOMER_ROUTE_HISTORY TABLE
-- ============================================================================

ALTER TABLE public.customer_route_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access on customer_route_history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Admin teknisi full access on customer_route_history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Teknisi read all customer route history" ON public.customer_route_history;
DROP POLICY IF EXISTS "ISP read own customer route history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Admin insert customer_route_history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Admin teknisi insert customer_route_history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Admin update customer_route_history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Admin teknisi update customer_route_history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Admin delete customer_route_history" ON public.customer_route_history;
DROP POLICY IF EXISTS "Admin teknisi delete customer_route_history" ON public.customer_route_history;

CREATE POLICY "Admin teknisi full access on customer_route_history"
ON public.customer_route_history
FOR ALL
USING (public.get_user_role() IN ('admin', 'teknisi'))
WITH CHECK (public.get_user_role() IN ('admin', 'teknisi'));

CREATE POLICY "ISP read own customer route history"
ON public.customer_route_history
FOR SELECT
USING (
  public.get_user_role() = 'isp'
  AND public.can_current_isp_access_customer(customer_id)
);

-- ============================================================================
-- VERIFY POLICIES
-- ============================================================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
