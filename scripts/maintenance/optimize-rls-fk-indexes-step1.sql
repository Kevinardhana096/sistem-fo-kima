-- Supabase performance optimization, step 1
-- Safe to re-run. Keeps application behavior unchanged.
-- Apply in Supabase SQL Editor or through the migration runner.

-- ============================================================================
-- FOREIGN KEY INDEXES FLAGGED BY SUPABASE ADVISOR
-- ============================================================================
-- These indexes reduce FK checks and joins on delete/restore/update paths.

CREATE INDEX IF NOT EXISTS idx_contract_versions_deleted_by
ON public.contract_versions (deleted_by);

CREATE INDEX IF NOT EXISTS idx_contracts_deleted_by
ON public.contracts (deleted_by);

CREATE INDEX IF NOT EXISTS idx_customers_deleted_by
ON public.customers (deleted_by);

CREATE INDEX IF NOT EXISTS idx_documents_deleted_by
ON public.documents (deleted_by);

CREATE INDEX IF NOT EXISTS idx_invoices_deleted_by
ON public.invoices (deleted_by);

CREATE INDEX IF NOT EXISTS idx_isp_contract_rows_deleted_by
ON public.isp_contract_rows (deleted_by);

CREATE INDEX IF NOT EXISTS idx_isps_deleted_by
ON public.isps (deleted_by);

CREATE INDEX IF NOT EXISTS idx_customer_route_versions_deleted_by
ON public.customer_route_versions (deleted_by);

CREATE INDEX IF NOT EXISTS idx_customer_route_points_deleted_by
ON public.customer_route_points (deleted_by);

CREATE INDEX IF NOT EXISTS idx_customer_isp_entry_points_entry_point_id
ON public.customer_isp_entry_points (isp_entry_point_id);

CREATE INDEX IF NOT EXISTS idx_invoices_document_id
ON public.invoices (document_id);

-- ============================================================================
-- RLS INITPLAN OPTIMIZATION FLAGGED BY SUPABASE ADVISOR
-- ============================================================================
-- Wrapping auth functions in SELECT allows Postgres to evaluate them once per
-- statement instead of repeatedly per row.

DROP POLICY IF EXISTS "Authenticated insert own activity_logs" ON public.activity_logs;
CREATE POLICY "Authenticated insert own activity_logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (
  (select auth.uid()) IS NOT NULL
  AND actor_user_id = (select auth.uid())
);

DROP POLICY IF EXISTS "Users manage own notification_states" ON public.notification_states;
CREATE POLICY "Users manage own notification_states"
ON public.notification_states
FOR ALL
USING (actor_user_id = (select auth.uid()))
WITH CHECK (actor_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authenticated read own user row" ON public.users;
CREATE POLICY "Authenticated read own user row"
ON public.users
FOR SELECT
USING (
  (select auth.uid()) IS NOT NULL
  AND (
    id::TEXT = (select auth.uid())::TEXT
    OR email = ((select auth.jwt()) ->> 'email')
  )
);

DROP POLICY IF EXISTS "ISP read own account mapping" ON public.isp_user_accounts;
CREATE POLICY "ISP read own account mapping"
ON public.isp_user_accounts
FOR SELECT
USING (
  public.get_user_role() = 'isp'
  AND auth_user_id = (select auth.uid())
);

ANALYZE public.activity_logs;
ANALYZE public.notification_states;
ANALYZE public.users;
ANALYZE public.isp_user_accounts;
ANALYZE public.contract_versions;
ANALYZE public.contracts;
ANALYZE public.customers;
ANALYZE public.documents;
ANALYZE public.invoices;
ANALYZE public.isp_contract_rows;
ANALYZE public.isps;
ANALYZE public.customer_route_versions;
ANALYZE public.customer_route_points;
ANALYZE public.customer_isp_entry_points;
