-- ============================================================================
-- ISP CONTRACT ROW CONTRACT START DATE
-- Store the contract document date per ISP contract row. Existing rows fall back
-- to the running period start so the detail table has a stable display value.
-- ============================================================================

ALTER TABLE public.isp_contract_rows
  ADD COLUMN IF NOT EXISTS contract_start_date DATE;

COMMENT ON COLUMN public.isp_contract_rows.contract_start_date IS
  'Contract document date for an ISP contract row; separate from the active period start.';

UPDATE public.isp_contract_rows
SET contract_start_date = period_start
WHERE contract_start_date IS NULL
  AND period_start IS NOT NULL;

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'isp_contract_rows'
  AND column_name = 'contract_start_date';
