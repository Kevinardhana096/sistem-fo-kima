BEGIN;

DO $$
DECLARE
  v_customer_id integer;
  v_contract_id integer;
  v_contract_number text;
  v_period record;
  v_period_start date;
  v_period_end date;
  v_invoice_number text;
  v_schedule_status invoice_schedule_status;
  v_existing_invoice_id integer;
BEGIN
  SELECT id
  INTO v_customer_id
  FROM public.customers
  WHERE name = 'PT Bank Tabungan Negara (Persero)'
    AND deleted_at IS NULL
  ORDER BY id DESC
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer PT Bank Tabungan Negara (Persero) not found';
  END IF;

  SELECT id, contract_number
  INTO v_contract_id, v_contract_number
  FROM public.contracts
  WHERE customer_id = v_customer_id
    AND deleted_at IS NULL
  ORDER BY start_date ASC, id ASC
  LIMIT 1;

  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Contract for customer % not found', v_customer_id;
  END IF;

  FOR v_period IN
    WITH version_periods AS (
      SELECT
        cv.id AS version_id,
        cv.start_date,
        cv.end_date,
        COALESCE(cv.contract_number, c.contract_number) AS contract_number,
        CASE
          WHEN cv.start_date = DATE '2023-07-08' AND cv.end_date = DATE '2024-07-07' THEN '187/INV.FO/XI/2023'
          WHEN cv.start_date = DATE '2024-07-08' AND cv.end_date = DATE '2025-07-07' THEN 'INV-065/KIMA/FO/VII/2024'
          WHEN cv.start_date = DATE '2025-07-08' AND cv.end_date = DATE '2026-07-07' THEN '087/FO/11/25'
          ELSE NULL
        END AS invoice_seed
      FROM public.contract_versions cv
      JOIN public.contracts c ON c.id = cv.contract_id
      WHERE cv.contract_id = v_contract_id
        AND cv.customer_id = v_customer_id
        AND cv.deleted_at IS NULL
        AND c.deleted_at IS NULL
    )
    SELECT
      NULL::integer AS version_id,
      DATE '2022-07-25' AS start_date,
      DATE '2023-07-24' AS end_date,
      v_contract_number AS contract_number,
      '065/INV.FO/XII/2022'::text AS invoice_seed
    UNION ALL
    SELECT version_id, start_date, end_date, contract_number, invoice_seed
    FROM version_periods
    WHERE invoice_seed IS NOT NULL
  LOOP
    v_period_start := v_period.start_date;

    WHILE v_period_start <= v_period.end_date LOOP
      v_period_end := LEAST(
        (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::date,
        v_period.end_date
      );
      v_invoice_number := v_period.invoice_seed || '-' || to_char(v_period_start, 'YYYYMM');
      v_schedule_status := CASE
        WHEN v_period.start_date = DATE '2025-07-08'
          AND v_period.end_date = DATE '2026-07-07'
          THEN 'active'::invoice_schedule_status
        ELSE 'history'::invoice_schedule_status
      END;

      SELECT id
      INTO v_existing_invoice_id
      FROM public.invoices
      WHERE customer_id = v_customer_id
        AND contract_id = v_contract_id
        AND COALESCE(contract_version_id, 0) = COALESCE(v_period.version_id, 0)
        AND period_year = EXTRACT(YEAR FROM v_period_start)::integer
        AND period_month = EXTRACT(MONTH FROM v_period_start)::integer
        AND deleted_at IS NULL
      ORDER BY id ASC
      LIMIT 1;

      IF v_existing_invoice_id IS NULL THEN
        INSERT INTO public.invoices (
          customer_id,
          contract_id,
          contract_version_id,
          contract_number,
          invoice_number,
          period_year,
          period_month,
          period_start_date,
          period_end_date,
          due_date,
          amount,
          status,
          paid_at,
          schedule_version,
          schedule_status,
          created_at,
          updated_at
        ) VALUES (
          v_customer_id,
          v_contract_id,
          v_period.version_id,
          v_period.contract_number,
          v_invoice_number,
          EXTRACT(YEAR FROM v_period_start)::integer,
          EXTRACT(MONTH FROM v_period_start)::integer,
          v_period_start,
          v_period_end,
          v_period_end,
          250000,
          'lunas',
          v_period_end::timestamp with time zone,
          1,
          v_schedule_status,
          NOW(),
          NOW()
        );
      ELSE
        UPDATE public.invoices
        SET
          contract_number = v_period.contract_number,
          invoice_number = v_invoice_number,
          period_start_date = v_period_start,
          period_end_date = v_period_end,
          due_date = v_period_end,
          amount = 250000,
          status = 'lunas',
          paid_at = COALESCE(paid_at, v_period_end::timestamp with time zone),
          schedule_version = COALESCE(schedule_version, 1),
          schedule_status = v_schedule_status,
          updated_at = NOW()
        WHERE id = v_existing_invoice_id;
      END IF;

      v_period_start := (v_period_start + INTERVAL '1 month')::date;
      v_existing_invoice_id := NULL;
    END LOOP;
  END LOOP;
END $$;

SELECT
  invoice_number,
  contract_number,
  contract_version_id,
  period_start_date,
  period_end_date,
  due_date,
  amount,
  status,
  paid_at,
  schedule_status
FROM public.invoices
WHERE customer_id = (
    SELECT id
    FROM public.customers
    WHERE name = 'PT Bank Tabungan Negara (Persero)'
      AND deleted_at IS NULL
    ORDER BY id DESC
    LIMIT 1
  )
  AND deleted_at IS NULL
ORDER BY period_start_date DESC, id DESC;

COMMIT;
