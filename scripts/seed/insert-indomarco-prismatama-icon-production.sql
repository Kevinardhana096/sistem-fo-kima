-- ============================================================================
-- UPSERT DATA CUSTOMER PT INDOMARCO PRISMATAMA - PRODUCTION
-- ============================================================================
-- Tanggal: 2026-06-29
-- Database: Supabase PostgreSQL (Production)
-- Catatan:
-- - Script ini khusus untuk lokasi PT Indomarco Prismatama di bawah PT Indonesia Comnets Plus.
-- - Data lama untuk lokasi ini dipisahkan dari seed gabungan agar tidak dobel saat di-run ulang.
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
  WHERE lower(trim(name)) = lower(trim('PT Indonesia Comnets Plus'))
     OR lower(name) LIKE '%indonesia comnets plus%'
     OR lower(name) LIKE '%icon%'
  ORDER BY CASE
    WHEN lower(trim(name)) = lower(trim('PT Indonesia Comnets Plus')) THEN 1
    WHEN lower(name) LIKE '%indonesia comnets plus%' THEN 2
    ELSE 3
  END, id
  LIMIT 1;

  IF v_isp_id IS NULL THEN
    INSERT INTO isps (name, status, paket, jumlah, billing_period_mode, activation_fee_amount, created_at, updated_at)
    VALUES ('PT Indonesia Comnets Plus', 'aktif', 'shared', 20, 'monthly', 0, NOW(), NOW())
    RETURNING id INTO v_isp_id;
  END IF;

  FOR row_data IN
    SELECT *
    FROM (VALUES
      ('CUST-ICON-INDOMARCO-001', 'PT Indomarco Prismatama', DATE '2023-12-28', DATE '2023-12-28', DATE '2024-12-27', 'sharing_core', 0, '1/16', 'KIMA.BAK-36/DBO/FO/VIII/2023', '177/INV.FO/IX/2023', 'lunas', 500000::numeric, 6000000::numeric, 2500000::numeric),
      ('CUST-ICON-INDOMARCO-001', 'PT Indomarco Prismatama', DATE '2023-12-28', DATE '2024-12-28', DATE '2025-12-27', 'sharing_core', 0, '1/16', 'KIMA.BAK-48/DBO/FO/VII/2024', 'INV-081/KIMA/FO/X/2024', 'lunas', 550000::numeric, 6600000::numeric, NULL::numeric),
      ('CUST-ICON-INDOMARCO-001', 'PT Indomarco Prismatama', DATE '2023-12-28', DATE '2025-12-28', DATE '2026-12-27', 'sharing_core', 0, '1/16', 'SP2K No.4500026783', '002/FO/1/26', 'lunas', 550000::numeric, 6600000::numeric, NULL::numeric)
    ) AS value(
      customer_code,
      customer_name,
      cooperation_start_date,
      contract_start_date,
      contract_end_date,
      core_type,
      core_total,
      sharing_ratio,
      contract_number,
      invoice_seed,
      invoice_status,
      monthly_amount,
      yearly_amount,
      activation_fee_amount
    )
  LOOP
    v_invoice_status := row_data.invoice_status;
    v_contract_number := CASE
      WHEN row_data.contract_number = '-' THEN 'NO-BAK-' || row_data.customer_code || '-' || to_char(row_data.contract_start_date, 'YYYYMMDD')
      ELSE row_data.contract_number
    END;

    SELECT id INTO v_customer_id
    FROM customers
    WHERE customer_code = row_data.customer_code
       OR name = row_data.customer_name
    ORDER BY id
    LIMIT 1;

    IF v_customer_id IS NULL THEN
      INSERT INTO customers (customer_code, isp_name, name, status, activation_fee_amount, contract_start_date, created_at, updated_at)
      VALUES (row_data.customer_code, 'PT Indonesia Comnets Plus', row_data.customer_name, 'aktif', COALESCE(row_data.activation_fee_amount, 0), row_data.cooperation_start_date, NOW(), NOW())
      RETURNING id INTO v_customer_id;
    ELSE
      UPDATE customers
      SET
        customer_code = COALESCE(customer_code, row_data.customer_code),
        isp_name = 'PT Indonesia Comnets Plus',
        name = row_data.customer_name,
        activation_fee_amount = CASE
          WHEN COALESCE(activation_fee_amount, 0) = 0
            THEN COALESCE(row_data.activation_fee_amount, activation_fee_amount, 0)
          ELSE activation_fee_amount
        END,
        contract_start_date = COALESCE(contract_start_date, row_data.cooperation_start_date),
        updated_at = NOW()
      WHERE id = v_customer_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM customer_isp_memberships
      WHERE customer_id = v_customer_id
        AND isp_id = v_isp_id
    ) THEN
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
      INSERT INTO contracts (
        customer_id,
        contract_number,
        start_date,
        end_date,
        core_type,
        core_total,
        sharing_ratio,
        status,
        billing_every,
        billing_unit,
        created_at,
        updated_at
      )
      VALUES (
        v_customer_id,
        v_contract_number,
        row_data.contract_start_date,
        row_data.contract_end_date,
        row_data.core_type::core_allocation_type,
        row_data.core_total,
        row_data.sharing_ratio,
        (CASE WHEN row_data.contract_end_date >= CURRENT_DATE THEN 'aktif' ELSE 'expired' END)::contract_status,
        1,
        'bulan',
        NOW(),
        NOW()
      )
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
      INSERT INTO contract_versions (
        contract_id,
        customer_id,
        version_number,
        start_date,
        end_date,
        core_type,
        core_total,
        shared_core_ratio,
        monthly_amount,
        yearly_amount,
        remarks,
        created_at,
        updated_at
      )
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
        'Imported from PT Indomarco Prismatama spreadsheet batch',
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

    IF NOT EXISTS (
      SELECT 1
      FROM documents
      WHERE customer_id = v_customer_id
        AND contract_id = v_contract_id
        AND jenis_dokumen IN ('kontrak'::document_type, 'BAK'::document_type)
    ) THEN
      INSERT INTO documents (
        customer_id,
        contract_id,
        contract_version_id,
        contract_number,
        jenis_dokumen,
        nomor_dokumen,
        tanggal_dokumen,
        file_url,
        created_at
      )
      VALUES (
        v_customer_id,
        v_contract_id,
        v_version_id,
        v_contract_number,
        'BAK'::document_type,
        v_contract_number,
        row_data.contract_start_date,
        'https://files.kima.local/bak/' || replace(replace(v_contract_number, '/', '-'), ' ', '-') || '.pdf',
        NOW()
      );
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
        INSERT INTO documents (
          customer_id,
          contract_id,
          contract_version_id,
          contract_number,
          jenis_dokumen,
          nomor_dokumen,
          tanggal_dokumen,
          file_url,
          created_at
        )
        VALUES (
          v_customer_id,
          v_contract_id,
          v_version_id,
          v_contract_number,
          'invoice'::document_type,
          v_invoice_number,
          v_period_start,
          'https://files.kima.local/invoices/' || v_invoice_number || '.pdf',
          NOW()
        )
        RETURNING id INTO v_doc_id;
      ELSE
        UPDATE documents
        SET
          contract_id = v_contract_id,
          contract_version_id = v_version_id,
          contract_number = v_contract_number,
          tanggal_dokumen = v_period_start,
          updated_at = NOW()
        WHERE id = v_doc_id;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM invoices
        WHERE customer_id = v_customer_id
          AND invoice_number = v_invoice_number
      ) THEN
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
        INSERT INTO invoices (
          customer_id,
          contract_id,
          contract_version_id,
          contract_number,
          invoice_number,
          period_year,
          period_month,
          period_start_date,
          period_end_date,
          amount,
          status,
          schedule_version,
          schedule_status,
          document_id,
          paid_at,
          created_at,
          updated_at
        )
        VALUES (
          v_customer_id,
          v_contract_id,
          v_version_id,
          v_contract_number,
          v_invoice_number,
          EXTRACT(YEAR FROM v_period_start)::int,
          EXTRACT(MONTH FROM v_period_start)::int,
          v_period_start,
          v_period_end,
          row_data.monthly_amount,
          v_invoice_status,
          1,
          v_schedule_status,
          v_doc_id,
          CASE WHEN row_data.invoice_status = 'lunas' THEN NOW() ELSE NULL END,
          NOW(),
          NOW()
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Verification Query
SELECT
  c.name AS customer_name,
  c.customer_code,
  COUNT(DISTINCT ct.id) AS contract_count,
  COUNT(DISTINCT cv.id) AS version_count,
  COUNT(DISTINCT i.id) AS invoice_count,
  MIN(ct.start_date) AS first_contract_start,
  MAX(ct.end_date) AS last_contract_end
FROM customers c
LEFT JOIN contracts ct ON ct.customer_id = c.id
LEFT JOIN contract_versions cv ON cv.contract_id = ct.id
LEFT JOIN invoices i ON i.contract_id = ct.id
WHERE c.customer_code = 'CUST-ICON-INDOMARCO-001'
GROUP BY c.name, c.customer_code
ORDER BY c.name;

COMMIT;
