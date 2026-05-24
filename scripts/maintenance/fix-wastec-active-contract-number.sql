BEGIN;

WITH target_customer AS (
  SELECT id
  FROM public.customers
  WHERE name = 'PT Karya Teknik Mulia (PT Wastec International)'
    AND deleted_at IS NULL
  ORDER BY id DESC
  LIMIT 1
),
target_contract AS (
  SELECT c.id
  FROM public.contracts c
  JOIN target_customer tc ON tc.id = c.customer_id
  WHERE c.start_date = DATE '2025-08-18'
    AND c.end_date = DATE '2026-08-17'
    AND c.deleted_at IS NULL
  ORDER BY c.id DESC
  LIMIT 1
)
UPDATE public.contracts c
SET
  contract_number = 'KIMA.BAK-46/DBO/FO/X/2025',
  updated_at = NOW()
FROM target_contract tc
WHERE c.id = tc.id;

WITH target_customer AS (
  SELECT id
  FROM public.customers
  WHERE name = 'PT Karya Teknik Mulia (PT Wastec International)'
    AND deleted_at IS NULL
  ORDER BY id DESC
  LIMIT 1
),
target_contract AS (
  SELECT c.id
  FROM public.contracts c
  JOIN target_customer tc ON tc.id = c.customer_id
  WHERE c.start_date = DATE '2025-08-18'
    AND c.end_date = DATE '2026-08-17'
    AND c.deleted_at IS NULL
  ORDER BY c.id DESC
  LIMIT 1
)
UPDATE public.invoices i
SET
  contract_number = 'KIMA.BAK-46/DBO/FO/X/2025',
  updated_at = NOW()
FROM target_contract tc
WHERE i.contract_id = tc.id
  AND i.schedule_status = 'active'
  AND i.deleted_at IS NULL;

COMMIT;
