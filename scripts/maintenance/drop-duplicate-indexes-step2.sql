-- Supabase performance optimization, step 2
-- Safe to re-run. Removes only indexes proven identical by Supabase advisor.
-- This does not change table data, RLS policies, or application query behavior.

-- Keep idx_customer_route_history_customer_created because it is declared in
-- scripts/maintenance/add-performance-indexes.sql.
DROP INDEX IF EXISTS public.idx_customer_route_history_customer_created_at;

-- Keep idx_documents_customer_date_desc because it is declared in
-- scripts/maintenance/add-performance-indexes.sql.
DROP INDEX IF EXISTS public.idx_documents_customer_date;

ANALYZE public.customer_route_history;
ANALYZE public.documents;
