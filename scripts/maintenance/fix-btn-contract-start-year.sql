-- Fix PT Bank Tabungan Negara (Persero) contract start year.
-- This script only updates the customer master record so dashboard growth
-- uses the intended historical start date.

BEGIN;

SELECT
  id,
  name,
  contract_start_date,
  created_at,
  updated_at
FROM customers
WHERE name = 'PT Bank Tabungan Negara (Persero)'
  AND deleted_at IS NULL;

UPDATE customers
SET
  contract_start_date = DATE '2022-07-25',
  updated_at = NOW()
WHERE name = 'PT Bank Tabungan Negara (Persero)'
  AND deleted_at IS NULL
  AND contract_start_date IS DISTINCT FROM DATE '2022-07-25';

SELECT
  id,
  name,
  contract_start_date,
  created_at,
  updated_at
FROM customers
WHERE name = 'PT Bank Tabungan Negara (Persero)'
  AND deleted_at IS NULL;

COMMIT;

