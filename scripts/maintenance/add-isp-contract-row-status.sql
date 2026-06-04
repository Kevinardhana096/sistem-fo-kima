-- ============================================================================
-- ISP CONTRACT ROW STATUS COMPATIBILITY
-- Add a direct `status` column to `isp_contract_rows` so the current frontend
-- payload can be written without PostgREST rejecting the insert.
-- ============================================================================

ALTER TABLE public.isp_contract_rows
  ADD COLUMN IF NOT EXISTS status TEXT;

COMMENT ON COLUMN public.isp_contract_rows.status IS
  'Compatibility status for frontend row state; kept separate from renewal_status.';

UPDATE public.isp_contract_rows
SET status = CASE
  WHEN deleted_at IS NOT NULL THEN 'berhenti'
  WHEN period_end IS NOT NULL AND period_end < CURRENT_DATE THEN 'expired'
  ELSE 'aktif'
END
WHERE status IS NULL OR btrim(status) = '';

ALTER TABLE public.isp_contract_rows
  ALTER COLUMN status SET DEFAULT 'aktif';

ALTER TABLE public.isp_contract_rows
  ALTER COLUMN status SET NOT NULL;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'isp_contract_rows'
  AND column_name = 'status';
