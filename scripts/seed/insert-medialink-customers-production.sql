-- ============================================================================
-- UPSERT DATA CUSTOMER PT MEDIALINK GLOBAL MANDIRI - PRODUCTION
-- ============================================================================
-- Tanggal: 2026-05-14
-- Database: Supabase PostgreSQL (Production)
-- Cara Pakai: Copy-paste script ini ke Supabase SQL Editor dan Run
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_isp_id BIGINT;
  v_customer_id BIGINT;
  v_contract_id BIGINT;
  v_version_id BIGINT;
  v_doc_id BIGINT;
  v_month_index INT;
  v_invoice_number TEXT;
  v_contract_number TEXT;
  v_period_start DATE;
  v_period_end DATE;
  v_invoice_status invoices.status%TYPE;
  v_schedule_status invoices.schedule_status%TYPE := 'active';
  row_data RECORD;
BEGIN
  SELECT id INTO v_isp_id
  FROM isps
  WHERE lower(trim(name)) = lower(trim('PT Medialink Global Mandiri'))
     OR lower(name) LIKE '%medialink%'
  ORDER BY CASE
    WHEN lower(trim(name)) = lower(trim('PT Medialink Global Mandiri')) THEN 1
    WHEN lower(name) LIKE '%medialink global mandiri%' THEN 2
    ELSE 3
  END, id
  LIMIT 1;

  IF v_isp_id IS NULL THEN
    INSERT INTO isps (name, status, paket, jumlah, billing_period_mode, activation_fee_amount, created_at, updated_at)
    VALUES ('PT Medialink Global Mandiri', 'aktif', 'shared', 0, 'monthly', 0, NOW(), NOW())
    RETURNING id INTO v_isp_id;
  END IF;

  FOR row_data IN
    SELECT *
    FROM (VALUES
      ('CUST-MLK-UTOMODECK-001', 'PT Utomodeck Metal Works', DATE '2023-07-13', DATE '2023-07-13', DATE '2024-07-12', 'sharing_core', 0, '1/16', 'KIMA.BAK-30/DBO/FO/VII/2023', '155/INV.FO/VII/2023', 'lunas', 500000::numeric, 6000000::numeric, 2500000::numeric),
      ('CUST-MLK-UTOMODECK-001', 'PT Utomodeck Metal Works', DATE '2023-07-13', DATE '2024-07-13', DATE '2025-07-12', 'sharing_core', 0, '1/16', 'KIMA.BAK-14/DBO/FO/V/2025', 'INV-058/KIMA/FO/VI/2025', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-MLK-UTOMODECK-001', 'PT Utomodeck Metal Works', DATE '2023-07-13', DATE '2025-07-13', DATE '2026-07-12', 'sharing_core', 0, '1/16', 'KIMA.BAK-48/DBO/FO/X/2025', '082/FO/10/25', 'belum_ditagih', 500000::numeric, 6000000::numeric, NULL::numeric),

      ('CUST-MLK-MERAPI-001', 'PT Merapi Utama Pharma', DATE '2023-01-26', DATE '2023-01-26', DATE '2024-01-25', 'sharing_core', 0, '1/32', 'KIMA.BAK-01/DBO/FO/I/2023', '092/INV.FO/II/2023', 'lunas', 250000::numeric, 3000000::numeric, 2500000::numeric),
      ('CUST-MLK-MERAPI-001', 'PT Merapi Utama Pharma', DATE '2023-01-26', DATE '2024-01-26', DATE '2025-01-25', 'sharing_core', 0, '1/32', 'KIMA.BAK-42/DBO/FO/VII/2024', 'INV-076/KIMA/FO/IX/2024', 'lunas', 250000::numeric, 3000000::numeric, NULL::numeric),
      ('CUST-MLK-MERAPI-001', 'PT Merapi Utama Pharma', DATE '2023-01-26', DATE '2025-01-26', DATE '2026-01-25', 'sharing_core', 0, '1/32', 'KIMA.BAK-13/DBO/FO/V/2025', 'INV-057/KIMA/FO/VI/2025', 'lunas', 250000::numeric, 3000000::numeric, NULL::numeric),

      ('CUST-MLK-SINOTRANS-JUN-001', 'PT Sinotrans Overseas Indonesia (Juni)', DATE '2025-06-04', DATE '2025-06-04', DATE '2026-06-03', 'sharing_core', 0, '1/16', 'KIMA.BAK-17/DBO/FO/VI/2025', '084/FO/10/25', 'belum_ditagih', 500000::numeric, 6000000::numeric, 2500000::numeric),

      ('CUST-MLK-SINOTRANS-SEP-001', 'PT Sinotrans Overseas Indonesia (Sept)', DATE '2025-09-10', DATE '2025-09-10', DATE '2026-09-09', 'sharing_core', 0, '1/16', 'KIMA.BAK-06/DBO/FO/IX/2025', '083/FO/10/25', 'belum_ditagih', 500000::numeric, 6000000::numeric, 2500000::numeric),

      ('CUST-MLK-ANDIARTA-001', 'PT Andiarta Muzizat (Ninja Express)', DATE '2023-09-18', DATE '2023-09-18', DATE '2024-09-17', 'sharing_core', 0, '1/16', 'KIMA.BAK-44/DBO/FO/VII/2024', 'INV-078/KIMA/FO/IX/2024', 'lunas', 500000::numeric, 6000000::numeric, 2500000::numeric),
      ('CUST-MLK-ANDIARTA-001', 'PT Andiarta Muzizat (Ninja Express)', DATE '2023-09-18', DATE '2024-09-18', DATE '2025-09-17', 'sharing_core', 0, '1/16', 'KIMA.BAK-16/DBO/FO/2025', 'INV-060/KIMA/FO/VI/2025', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-MLK-ANDIARTA-001', 'PT Andiarta Muzizat (Ninja Express)', DATE '2023-09-18', DATE '2025-09-18', DATE '2026-09-17', 'sharing_core', 0, '1/32', 'KIMA0BAK44/DBO/FO/VIII/2025', '083/FO/10/25', 'belum_ditagih', 250000::numeric, 3000000::numeric, NULL::numeric)
    ) AS value(customer_code, customer_name, cooperation_start_date, contract_start_date, contract_end_date, core_type, core_total, sharing_ratio, contract_number, invoice_seed, invoice_status, monthly_amount, yearly_amount, activation_fee_amount)
  LOOP
    v_invoice_status := row_data.invoice_status;
    v_contract_number := CASE
      WHEN row_data.contract_number = '-' THEN 'NO-BAK-' || row_data.customer_code || '-' || to_char(row_data.contract_start_date, 'YYYYMMDD')
      ELSE row_data.contract_number
    END;

    -- Check if contract_number already exists for a different customer
    IF EXISTS (
      SELECT 1 FROM contracts c
      JOIN customers cu ON c.customer_id = cu.id
      WHERE c.contract_number = v_contract_number
        AND cu.customer_code != row_data.customer_code
    ) THEN
      -- Add customer code suffix to make it unique
      v_contract_number := v_contract_number || '-' || row_data.customer_code;
    END IF;

    SELECT id INTO v_customer_id
    FROM customers
    WHERE customer_code = row_data.customer_code
    ORDER BY id
    LIMIT 1;

    IF v_customer_id IS NULL THEN
      INSERT INTO customers (customer_code, isp_name, name, status, activation_fee_amount, contract_start_date, created_at, updated_at)
      VALUES (row_data.customer_code, 'PT Medialink Global Mandiri', row_data.customer_name, 'aktif', COALESCE(row_data.activation_fee_amount, 0), row_data.cooperation_start_date, NOW(), NOW())
      RETURNING id INTO v_customer_id;
    ELSE
      UPDATE customers
      SET
        customer_code = COALESCE(customer_code, row_data.customer_code),
        isp_name = 'PT Medialink Global Mandiri',
        name = row_data.customer_name,
        activation_fee_amount = CASE WHEN COALESCE(activation_fee_amount, 0) = 0 THEN COALESCE(row_data.activation_fee_amount, activation_fee_amount, 0) ELSE activation_fee_amount END,
        contract_start_date = COALESCE(contract_start_date, row_data.cooperation_start_date),
        updated_at = NOW()
      WHERE id = v_customer_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM customer_isp_memberships WHERE customer_id = v_customer_id AND isp_id = v_isp_id) THEN
      INSERT INTO customer_isp_memberships (customer_id, isp_id, created_at, updated_at)
      VALUES (v_customer_id, v_isp_id, NOW(), NOW());
    END IF;

    SELECT id INTO v_contract_id
    FROM contracts
    WHERE customer_id = v_customer_id
      AND contract_number = v_contract_number
    ORDER BY id
    LIMIT 1;

    IF v_contract_id IS NULL THEN
      INSERT INTO contracts (customer_id, contract_number, start_date, end_date, core_type, core_total, sharing_ratio, status, billing_every, billing_unit, created_at, updated_at)
      VALUES (v_customer_id, v_contract_number, row_data.contract_start_date, row_data.contract_end_date, row_data.core_type::core_allocation_type, row_data.core_total, row_data.sharing_ratio, (CASE WHEN row_data.contract_end_date >= CURRENT_DATE THEN 'aktif' ELSE 'expired' END)::contract_status, 1, 'bulan', NOW(), NOW())
      RETURNING id INTO v_contract_id;
    ELSE
      UPDATE contracts
      SET
        start_date = LEAST(start_date, row_data.contract_start_date),
        end_date = GREATEST(end_date, row_data.contract_end_date),
        core_type = row_data.core_type::core_allocation_type,
        core_total = row_data.core_total,
        sharing_ratio = row_data.sharing_ratio,
        status = (CASE WHEN row_data.contract_end_date >= CURRENT_DATE THEN 'aktif' ELSE 'expired' END)::contract_status,
        billing_every = COALESCE(billing_every, 1),
        billing_unit = COALESCE(billing_unit, 'bulan'),
        updated_at = NOW()
      WHERE id = v_contract_id;
    END IF;

    SELECT id INTO v_version_id
    FROM contract_versions
    WHERE contract_id = v_contract_id
      AND start_date = row_data.contract_start_date
      AND end_date = row_data.contract_end_date
    ORDER BY id
    LIMIT 1;

    IF v_version_id IS NULL THEN
      INSERT INTO contract_versions (contract_id, customer_id, version_number, start_date, end_date, core_type, core_total, shared_core_ratio, monthly_amount, yearly_amount, remarks, created_at, updated_at)
      VALUES (
        v_contract_id,
        v_customer_id,
        (SELECT COALESCE(MAX(version_number), 0) + 1 FROM contract_versions WHERE contract_id = v_contract_id),
        row_data.contract_start_date,
        row_data.contract_end_date,
        row_data.core_type::core_allocation_type,
        row_data.core_total,
        row_data.sharing_ratio,
        row_data.monthly_amount,
        row_data.yearly_amount,
        'Imported from Medialink spreadsheet batch',
        NOW(),
        NOW()
      )
      RETURNING id INTO v_version_id;
    ELSE
      UPDATE contract_versions
      SET
        core_type = row_data.core_type::core_allocation_type,
        core_total = row_data.core_total,
        shared_core_ratio = row_data.sharing_ratio,
        monthly_amount = row_data.monthly_amount,
        yearly_amount = row_data.yearly_amount,
        updated_at = NOW()
      WHERE id = v_version_id;
    END IF;

    IF row_data.contract_number <> '-' AND NOT EXISTS (SELECT 1 FROM documents WHERE customer_id = v_customer_id AND contract_id = v_contract_id AND jenis_dokumen IN ('kontrak'::document_type, 'BAK'::document_type)) THEN
      INSERT INTO documents (customer_id, contract_id, contract_version_id, contract_number, jenis_dokumen, nomor_dokumen, tanggal_dokumen, file_url, created_at)
      VALUES (v_customer_id, v_contract_id, v_version_id, v_contract_number, 'BAK'::document_type, v_contract_number, row_data.contract_start_date, 'https://files.kima.local/bak/' || v_contract_number || '.pdf', NOW());
    END IF;

    FOR v_month_index IN 0..11 LOOP
      v_period_start := (row_data.contract_start_date + (v_month_index || ' month')::INTERVAL)::date;
      v_period_end := (v_period_start + INTERVAL '1 month' - INTERVAL '1 day')::date;
      v_invoice_number := row_data.invoice_seed || '-' || to_char(v_period_start, 'YYYYMM');

      SELECT id INTO v_doc_id
      FROM documents
      WHERE customer_id = v_customer_id
        AND jenis_dokumen = 'invoice'::document_type
        AND nomor_dokumen = v_invoice_number
      ORDER BY id
      LIMIT 1;

      IF v_doc_id IS NULL THEN
        INSERT INTO documents (customer_id, contract_id, contract_version_id, contract_number, jenis_dokumen, nomor_dokumen, tanggal_dokumen, file_url, created_at)
        VALUES (v_customer_id, v_contract_id, v_version_id, v_contract_number, 'invoice'::document_type, v_invoice_number, v_period_start, 'https://files.kima.local/invoices/' || v_invoice_number || '.pdf', NOW())
        RETURNING id INTO v_doc_id;
      ELSE
        UPDATE documents
        SET contract_id = v_contract_id, contract_version_id = v_version_id, contract_number = v_contract_number, tanggal_dokumen = v_period_start
        WHERE id = v_doc_id;
      END IF;

      IF EXISTS (SELECT 1 FROM invoices WHERE customer_id = v_customer_id AND invoice_number = v_invoice_number) THEN
        UPDATE invoices
        SET
          contract_id = v_contract_id,
          contract_version_id = v_version_id,
          contract_number = v_contract_number,
          period_year = EXTRACT(YEAR FROM v_period_start)::int,
          period_month = EXTRACT(MONTH FROM v_period_start)::int,
          period_start_date = v_period_start,
          period_end_date = v_period_end,
          amount = row_data.monthly_amount,
          status = v_invoice_status,
          schedule_version = 1,
          schedule_status = v_schedule_status,
          document_id = v_doc_id,
          updated_at = NOW()
        WHERE customer_id = v_customer_id
          AND invoice_number = v_invoice_number;
      ELSE
        INSERT INTO invoices (customer_id, contract_id, contract_version_id, contract_number, invoice_number, period_year, period_month, period_start_date, period_end_date, amount, status, schedule_version, schedule_status, document_id, paid_at, created_at, updated_at)
        VALUES (v_customer_id, v_contract_id, v_version_id, v_contract_number, v_invoice_number, EXTRACT(YEAR FROM v_period_start)::int, EXTRACT(MONTH FROM v_period_start)::int, v_period_start, v_period_end, row_data.monthly_amount, v_invoice_status, 1, v_schedule_status, v_doc_id, CASE WHEN row_data.invoice_status = 'lunas' THEN NOW() ELSE NULL END, NOW(), NOW());
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Verification Query: Summary per Contract
SELECT
  c.name AS customer_name,
  ct.contract_number,
  ct.start_date,
  ct.end_date,
  ct.core_type,
  ct.core_total,
  ct.sharing_ratio,
  ct.status AS contract_status,
  COUNT(DISTINCT cv.id) AS version_count,
  COUNT(i.id) AS invoice_count,
  SUM(i.amount) AS invoice_total,
  STRING_AGG(DISTINCT cv.version_number::text || ': ' || cv.start_date::text || ' - ' || cv.end_date::text || ' (Rp ' || cv.monthly_amount::text || '/mo)', ', ' ORDER BY cv.version_number::text || ': ' || cv.start_date::text || ' - ' || cv.end_date::text || ' (Rp ' || cv.monthly_amount::text || '/mo)') AS versions_detail
FROM customers c
JOIN contracts ct ON ct.customer_id = c.id
LEFT JOIN contract_versions cv ON cv.contract_id = ct.id
LEFT JOIN invoices i ON i.contract_id = ct.id
WHERE c.isp_name = 'PT Medialink Global Mandiri'
GROUP BY c.name, ct.id, ct.contract_number, ct.start_date, ct.end_date, ct.core_type, ct.core_total, ct.sharing_ratio, ct.status
ORDER BY c.name, ct.end_date DESC;

COMMIT;
