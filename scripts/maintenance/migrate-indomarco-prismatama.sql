-- Migrate PT Indomarco Prismatama existing rows to the cleaned customer name.
-- Run in Supabase SQL Editor. Review audit output before COMMIT.
-- This is a one-time data correction for existing production rows.

BEGIN;

-- Before audit: rows that still use the old name or need cleanup.
SELECT
  c.id AS customer_id,
  c.customer_code,
  c.name AS current_customer_name,
  c.isp_name,
  c.status,
  c.contract_start_date,
  c.activation_fee_amount,
  COUNT(DISTINCT ct.id) AS contract_count,
  COUNT(DISTINCT cv.id) AS version_count
FROM customers c
LEFT JOIN contracts ct ON ct.customer_id = c.id
LEFT JOIN contract_versions cv ON cv.customer_id = c.id
WHERE c.customer_code = 'CUST-ICON-INDOMARCO-001'
   OR lower(trim(c.name)) IN (
     lower(trim('PT Indomarco Prismatama')),
     lower(trim('PT Indomarco Prismatama (ICON+)'))
   )
GROUP BY c.id, c.customer_code, c.name, c.isp_name, c.status, c.contract_start_date, c.activation_fee_amount
ORDER BY c.id;

DO $$
DECLARE
  v_customer_rows_updated INT := 0;
  v_version_rows_updated INT := 0;
BEGIN
  UPDATE customers
  SET
    name = 'PT Indomarco Prismatama',
    isp_name = 'PT Indonesia Comnets Plus',
    contract_start_date = COALESCE(contract_start_date, DATE '2023-12-28'),
    activation_fee_amount = COALESCE(activation_fee_amount, 2500000),
    updated_at = NOW()
  WHERE customer_code = 'CUST-ICON-INDOMARCO-001'
     OR lower(trim(name)) = lower(trim('PT Indomarco Prismatama (ICON+)'));

  GET DIAGNOSTICS v_customer_rows_updated = ROW_COUNT;

  UPDATE contract_versions
  SET
    remarks = 'Imported from PT Indomarco Prismatama spreadsheet batch',
    updated_at = NOW()
  WHERE customer_id IN (
    SELECT id
    FROM customers
    WHERE customer_code = 'CUST-ICON-INDOMARCO-001'
       OR lower(trim(name)) = lower(trim('PT Indomarco Prismatama'))
  )
  AND remarks = 'Imported from PT Indomarco Prismatama ICON+ spreadsheet batch';

  GET DIAGNOSTICS v_version_rows_updated = ROW_COUNT;

  RAISE NOTICE 'Updated % customer rows and % contract version rows for PT Indomarco Prismatama.',
    v_customer_rows_updated,
    v_version_rows_updated;
END $$;

-- After audit: cleaned rows.
SELECT
  c.id AS customer_id,
  c.customer_code,
  c.name AS current_customer_name,
  c.isp_name,
  c.status,
  c.contract_start_date,
  c.activation_fee_amount,
  COUNT(DISTINCT ct.id) AS contract_count,
  COUNT(DISTINCT cv.id) AS version_count
FROM customers c
LEFT JOIN contracts ct ON ct.customer_id = c.id
LEFT JOIN contract_versions cv ON cv.customer_id = c.id
WHERE c.customer_code = 'CUST-ICON-INDOMARCO-001'
GROUP BY c.id, c.customer_code, c.name, c.isp_name, c.status, c.contract_start_date, c.activation_fee_amount
ORDER BY c.id;

COMMIT;
