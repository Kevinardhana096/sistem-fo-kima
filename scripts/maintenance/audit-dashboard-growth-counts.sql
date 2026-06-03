-- Audit dashboard growth counts against database source rows.
-- Purpose:
-- - Check yearly cumulative location counts used by the dashboard growth card.
-- - Compare dashboard logic (customer.contract_start_date fallback to created_at)
--   with a contract-based baseline (earliest contract start per customer).
-- Run this in Supabase SQL Editor.

BEGIN;

DROP TABLE IF EXISTS tmp_dashboard_growth_audit;
DROP TABLE IF EXISTS tmp_customer_growth_mismatch;

CREATE TEMP TABLE tmp_dashboard_growth_audit AS
WITH params AS (
  SELECT
    2019::int AS start_year,
    EXTRACT(YEAR FROM CURRENT_DATE)::int AS end_year
),
years AS (
  SELECT generate_series(p.start_year, p.end_year) AS year
  FROM params p
),
customer_dates AS (
  SELECT
    c.id AS customer_id,
    c.name AS customer_name,
    c.status AS customer_status,
    c.contract_start_date,
    c.created_at,
    MIN(ct.start_date) FILTER (WHERE ct.deleted_at IS NULL) AS first_contract_start_date,
    MIN(ct.end_date) FILTER (WHERE ct.deleted_at IS NULL) AS first_contract_end_date
  FROM customers c
  LEFT JOIN contracts ct
    ON ct.customer_id = c.id
  WHERE c.deleted_at IS NULL
  GROUP BY c.id, c.name, c.status, c.contract_start_date, c.created_at
)
SELECT
  y.year,
  COUNT(*) FILTER (
    WHERE COALESCE(cd.contract_start_date, cd.created_at::date) <= make_date(y.year, 12, 31)
  ) AS dashboard_location_count,
  COUNT(*) FILTER (
    WHERE cd.first_contract_start_date IS NOT NULL
      AND cd.first_contract_start_date <= make_date(y.year, 12, 31)
  ) AS contract_baseline_location_count,
  COUNT(*) FILTER (
    WHERE cd.contract_start_date IS NULL
  ) AS rows_missing_contract_start_date
FROM years y
CROSS JOIN customer_dates cd
GROUP BY y.year
ORDER BY y.year;

CREATE TEMP TABLE tmp_customer_growth_mismatch AS
WITH customer_dates AS (
  SELECT
    c.id AS customer_id,
    c.name AS customer_name,
    c.status AS customer_status,
    c.contract_start_date,
    c.created_at::date AS created_date,
    MIN(ct.start_date) FILTER (WHERE ct.deleted_at IS NULL) AS first_contract_start_date,
    MIN(ct.end_date) FILTER (WHERE ct.deleted_at IS NULL) AS first_contract_end_date
  FROM customers c
  LEFT JOIN contracts ct
    ON ct.customer_id = c.id
  WHERE c.deleted_at IS NULL
  GROUP BY c.id, c.name, c.status, c.contract_start_date, c.created_at
)
SELECT
  customer_id,
  customer_name,
  customer_status,
  contract_start_date,
  created_date,
  first_contract_start_date,
  first_contract_end_date,
  CASE
    WHEN contract_start_date IS NULL THEN 'contract_start_date_null'
    WHEN first_contract_start_date IS NULL THEN 'no_contract_row'
    WHEN contract_start_date <> first_contract_start_date THEN 'contract_start_date_differs_from_first_contract'
    ELSE 'ok'
  END AS audit_status
FROM customer_dates;

SELECT
  year,
  dashboard_location_count,
  contract_baseline_location_count,
  dashboard_location_count - contract_baseline_location_count AS delta,
  rows_missing_contract_start_date
FROM tmp_dashboard_growth_audit
ORDER BY year;

SELECT
  audit_status,
  COUNT(*) AS customer_count
FROM tmp_customer_growth_mismatch
GROUP BY audit_status
ORDER BY audit_status;

SELECT
  customer_id,
  customer_name,
  customer_status,
  contract_start_date,
  created_date,
  first_contract_start_date,
  first_contract_end_date,
  audit_status
FROM tmp_customer_growth_mismatch
WHERE audit_status <> 'ok'
ORDER BY customer_name;

ROLLBACK;

