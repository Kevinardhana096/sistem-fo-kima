-- Monitoring + Notification query-path optimization
-- Safe to re-run (IF NOT EXISTS)
-- Apply in Supabase SQL Editor

-- ============================================================================
-- MONITORING READ PATH
-- ============================================================================

-- Active customers scan (monitoring billing base)
CREATE INDEX IF NOT EXISTS idx_customers_active_deleted_name
ON public.customers (name)
WHERE status = 'aktif' AND deleted_at IS NULL;

-- Stopped customers scan (monitoring history base)
CREATE INDEX IF NOT EXISTS idx_customers_stopped_deleted_name
ON public.customers (name)
WHERE status = 'berhenti' AND deleted_at IS NULL;

-- Contracts by customer + period intersection, common for history and dashboard
CREATE INDEX IF NOT EXISTS idx_contracts_customer_period_active
ON public.contracts (customer_id, start_date, end_date)
WHERE deleted_at IS NULL;

-- Invoice lookups used by billing/history and alerts
CREATE INDEX IF NOT EXISTS idx_invoices_customer_year_month_active
ON public.invoices (customer_id, period_year, period_month, contract_id)
WHERE schedule_status = 'active' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_active_status_due_date
ON public.invoices (period_year, status, due_date, customer_id)
WHERE schedule_status = 'active' AND deleted_at IS NULL;

-- Route latest version per customer
CREATE INDEX IF NOT EXISTS idx_customer_route_versions_customer_latest_active
ON public.customer_route_versions (customer_id, version_number DESC, created_at DESC)
WHERE deleted_at IS NULL;

-- Membership traversal for ISP label lookup
CREATE INDEX IF NOT EXISTS idx_customer_isp_memberships_customer_isp
ON public.customer_isp_memberships (customer_id, isp_id);

-- ============================================================================
-- NOTIFICATION STATE PATH
-- ============================================================================

-- Fast read for current user unresolved notifications
CREATE INDEX IF NOT EXISTS idx_notification_states_user_unresolved
ON public.notification_states (actor_user_id, updated_at DESC)
WHERE resolved_at IS NULL;

-- Fast join by key for actor
CREATE INDEX IF NOT EXISTS idx_notification_states_user_key
ON public.notification_states (actor_user_id, notification_key);

-- Keep planner fresh for hot tables
ANALYZE public.customers;
ANALYZE public.contracts;
ANALYZE public.invoices;
ANALYZE public.customer_route_versions;
ANALYZE public.customer_isp_memberships;
ANALYZE public.notification_states;
