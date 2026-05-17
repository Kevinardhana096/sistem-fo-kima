-- ============================================================================
-- UPSERT DATA CUSTOMER PT APLIKANUSA LINTASARTA - PRODUCTION
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
  WHERE lower(trim(name)) = lower(trim('PT Aplikanusa Lintasarta'))
     OR lower(name) LIKE '%aplikanusa%'
     OR lower(name) LIKE '%lintasarta%'
  ORDER BY CASE
    WHEN lower(trim(name)) = lower(trim('PT Aplikanusa Lintasarta')) THEN 1
    WHEN lower(name) LIKE '%aplikanusa lintasarta%' THEN 2
    ELSE 3
  END, id
  LIMIT 1;

  IF v_isp_id IS NULL THEN
    INSERT INTO isps (name, status, paket, jumlah, billing_period_mode, activation_fee_amount, created_at, updated_at)
    VALUES ('PT Aplikanusa Lintasarta', 'aktif', 'shared', 6, 'monthly', 0, NOW(), NOW())
    RETURNING id INTO v_isp_id;
  END IF;

  FOR row_data IN
    SELECT *
    FROM (VALUES
      ('CUST-APL-WIKA-ATM-001', 'ATM Center WIKA Beton', DATE '2023-03-15', DATE '2023-03-15', DATE '2024-03-14', 'sharing_core', 0, '1/16', 'KIMA.BAK-10/DBO/FO/III/2023', '105/INV.FO/IV/2023', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-APL-WIKA-ATM-001', 'ATM Center WIKA Beton', DATE '2023-03-15', DATE '2024-03-15', DATE '2025-03-14', 'sharing_core', 0, '1/16', 'KIMA.BAK-28/DBO/FO/VI/2024', 'INV-055/KIMA/FO/VII/2024', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-APL-WIKA-ATM-001', 'ATM Center WIKA Beton', DATE '2023-03-15', DATE '2025-03-15', DATE '2026-03-14', 'sharing_core', 0, '1/16', 'KIMA.BAK-36/DBO/FO/VIII/2025', '098/FO/11/25', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-APL-WIKA-ATM-001', 'ATM Center WIKA Beton', DATE '2023-03-15', DATE '2026-03-15', DATE '2027-03-14', 'sharing_core', 0, '1/16', 'KIMA.04/DBO/FO/II/2026', '027/FO/4/26', 'belum_ditagih', 520000::numeric, 6240000::numeric, NULL::numeric),

      ('CUST-APL-HEXINDO-001', 'PT Hexindo Adiperkasa Tbk', DATE '2022-10-28', DATE '2022-10-28', DATE '2023-10-27', 'sharing_core', 0, '1/32', '-', '-', 'lunas', 250000::numeric, 3000000::numeric, NULL::numeric),
      ('CUST-APL-HEXINDO-001', 'PT Hexindo Adiperkasa Tbk', DATE '2022-10-28', DATE '2023-10-28', DATE '2024-10-27', 'sharing_core', 0, '1/32', 'KIMA.BAK-32/DBO/FO/VI/2024', 'INV-059/KIMA/FO/VII/2024', 'lunas', 250000::numeric, 3000000::numeric, NULL::numeric),
      ('CUST-APL-HEXINDO-001', 'PT Hexindo Adiperkasa Tbk', DATE '2022-10-28', DATE '2024-10-28', DATE '2026-10-27', 'sharing_core', 0, '1/32', 'KIMA.BAK-39/DBO/FO/VIII/2025', '096/FO/11/25', 'lunas', 250000::numeric, 3000000::numeric, NULL::numeric),

      ('CUST-APL-KAMADJAJA-001', 'PT Kamadjaja Logistics/Shopee', DATE '2022-08-13', DATE '2022-08-13', DATE '2023-08-12', 'sharing_core', 0, '1/16', '-', '077/INV.FO/XII/2022', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-APL-KAMADJAJA-001', 'PT Kamadjaja Logistics/Shopee', DATE '2022-08-13', DATE '2023-08-13', DATE '2024-08-12', 'sharing_core', 0, '1/16', 'KIMA.BAK-34/DBO/FO/VI/2024', 'INV-061/KIMA/FO/VII/2024', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-APL-KAMADJAJA-001', 'PT Kamadjaja Logistics/Shopee', DATE '2022-08-13', DATE '2024-08-13', DATE '2026-08-12', 'sharing_core', 0, '1/16', 'KIMA.BAK-40/DBO/FO/VIII/2025', '095/FO/11/25', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),

      ('CUST-APL-TUNAS-001', 'PT Tunas Kreasi/Sharp', DATE '2023-04-21', DATE '2023-04-21', DATE '2024-04-20', 'sharing_core', 0, '1/16', 'KIMA.BAK-36/DBO/FO/VI/2024', 'INV-063/KIMA/FO/VII/2024', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-APL-TUNAS-001', 'PT Tunas Kreasi/Sharp', DATE '2023-04-21', DATE '2024-04-21', DATE '2025-04-20', 'sharing_core', 0, '1/16', 'KIMA.BAK-43/DBO/FO/VIII/2025', '100/FO/11/25', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-APL-TUNAS-001', 'PT Tunas Kreasi/Sharp', DATE '2023-04-21', DATE '2026-04-21', DATE '2027-04-20', 'sharing_core', 0, '1/16', 'KIMA.BAK-05/DBO/FO/II/2026', '028/FO/4/26', 'belum_ditagih', 520000::numeric, 6240000::numeric, NULL::numeric),

      ('CUST-APL-MARS2-001', 'PT Mars Symbioscience Indonesia 2', DATE '2023-03-13', DATE '2023-03-13', DATE '2024-03-12', 'sharing_core', 0, '1/16', 'KIMA.BAK-09/DBO/FO/III/2023', '104/INV.FO/IV/2023', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-APL-MARS2-001', 'PT Mars Symbioscience Indonesia 2', DATE '2023-03-13', DATE '2024-03-13', DATE '2025-03-12', 'sharing_core', 0, '1/16', 'KIMA.BAK-31/DBO/FO/VI/2024', 'INV-058/KIMA/FO/VII/2024', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-APL-MARS2-001', 'PT Mars Symbioscience Indonesia 2', DATE '2023-03-13', DATE '2025-03-13', DATE '2026-03-12', 'sharing_core', 0, '1/16', 'KIMA.BAK-41/DBO/FO/VIII/2025', '094/FO/11/25', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-APL-MARS2-001', 'PT Mars Symbioscience Indonesia 2', DATE '2023-03-13', DATE '2026-03-13', DATE '2027-03-12', 'sharing_core', 0, '1/16', 'KIMA.BAK-07/DBO/FO/II/2026', '030/FO/4/26', 'belum_ditagih', 520000::numeric, 6240000::numeric, NULL::numeric),

      ('CUST-APL-PRIMA-001', 'PT Prima Indo Papua', DATE '2023-03-25', DATE '2023-03-25', DATE '2024-03-24', 'sharing_core', 0, '1/32', 'KIMA.BAK-05/DBO/FO/III/2023', '100/INV.FO/IV/2023', 'lunas', 250000::numeric, 3000000::numeric, NULL::numeric),
      ('CUST-APL-PRIMA-001', 'PT Prima Indo Papua', DATE '2023-03-25', DATE '2024-03-25', DATE '2025-03-24', 'sharing_core', 0, '1/32', 'KIMA.BAK-29/DBO/FO/VI/2024', 'INV-056/KIMA/FO/VII/2024', 'lunas', 250000::numeric, 3000000::numeric, NULL::numeric),
      ('CUST-APL-PRIMA-001', 'PT Prima Indo Papua', DATE '2023-03-25', DATE '2025-03-25', DATE '2026-03-24', 'sharing_core', 0, '1/32', 'KIMA.BAK-42/DBO/FO/VIII/2025', '093/FO/11/25', 'lunas', 250000::numeric, 3000000::numeric, NULL::numeric),
      ('CUST-APL-PRIMA-001', 'PT Prima Indo Papua', DATE '2023-03-25', DATE '2026-03-25', DATE '2027-03-24', 'sharing_core', 0, '1/32', 'KIMA.BAK-06/DBO/FO/II/2026', '029/Fo/4/26', 'belum_ditagih', 260000::numeric, 3120000::numeric, NULL::numeric),

      ('CUST-APL-CORE6-001', 'PT Aplikanusa Lintasarta (6 Core)', DATE '2023-01-14', DATE '2023-01-14', DATE '2024-01-13', 'core', 6, NULL, 'KIMA.BAK-48/DOP/FO/X/2023', '180/INV.FO/X/2023', 'lunas', 25200000::numeric, 75600000::numeric, NULL::numeric),
      ('CUST-APL-CORE6-001', 'PT Aplikanusa Lintasarta (6 Core)', DATE '2023-01-14', DATE '2024-01-14', DATE '2025-01-13', 'core', 6, NULL, 'KIMA.BAK-37/DOP/FO/VI/2024', 'INV-070/KIMA/FO/VIII/2024', 'lunas', 27000000::numeric, 324000000::numeric, NULL::numeric),
      ('CUST-APL-CORE6-001', 'PT Aplikanusa Lintasarta (6 Core)', DATE '2023-01-14', DATE '2025-01-14', DATE '2026-01-13', 'core', 6, NULL, 'KIMA.BAK-37/DOP/FO/VI/2024', 'INV-014/KIMA/FO/I/2025', 'lunas', 29400000::numeric, 352800000::numeric, NULL::numeric),
      ('CUST-APL-CORE6-001', 'PT Aplikanusa Lintasarta (6 Core)', DATE '2023-01-14', DATE '2026-01-14', DATE '2027-01-13', 'core', 6, NULL, 'KIMA.BAK-37/DOP/FO/VI/2024', '008/FO/1/26', 'lunas', 33000000::numeric, 396000000::numeric, NULL::numeric),

      ('CUST-APL-PRIMACOM-001', 'PT Primacom Interbuana', DATE '2025-03-25', DATE '2025-03-25', DATE '2026-03-24', 'sharing_core', 0, '1/16', 'KIMA.BAK-37/DBO/FO/VIII/2025', '099/FO/11/25', 'lunas', 500000::numeric, 6000000::numeric, 2500000::numeric),
      ('CUST-APL-PRIMACOM-001', 'PT Primacom Interbuana', DATE '2025-03-25', DATE '2026-03-25', DATE '2027-03-24', 'sharing_core', 0, '1/16', 'KIMA.BAK-08/DBO/FO/II/2026', '031/FO/4/26', 'belum_ditagih', 520000::numeric, 6240000::numeric, NULL::numeric),

      ('CUST-APL-TOYOTA-001', 'PT Toyota Kalla/Mega Akses Persada', DATE '2026-02-04', DATE '2026-02-04', DATE '2027-02-03', 'sharing_core', 0, '1/32', 'KIMA.BAK-11/DBO/FO/II/2026', '034/FO/4/26', 'belum_ditagih', 260000::numeric, 3120000::numeric, 2500000::numeric),

      ('CUST-APL-MARS-TELIN-001', 'PT Mars/Telekomunikasi Indonesia International', DATE '2025-11-18', DATE '2025-11-18', DATE '2026-11-17', 'sharing_core', 0, '1/16', 'KIMA.BAK-10/DBO/FO/II/2026', '033/FO/4/26', 'belum_ditagih', 500000::numeric, 6000000::numeric, 2500000::numeric),

      ('CUST-APL-HIPERNET-001', 'PT APL/Hipernet Indodata', DATE '2025-11-18', DATE '2025-11-18', DATE '2026-11-17', 'sharing_core', 0, '1/16', 'KIMA.BAK-09/DBO/FO/II/2026', '032/FO/4/26', 'belum_ditagih', 500000::numeric, 6000000::numeric, 2500000::numeric)
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
       OR name = row_data.customer_name
    ORDER BY id
    LIMIT 1;

    IF v_customer_id IS NULL THEN
      INSERT INTO customers (customer_code, isp_name, name, status, activation_fee_amount, contract_start_date, created_at, updated_at)
      VALUES (row_data.customer_code, 'PT Aplikanusa Lintasarta', row_data.customer_name, 'aktif', COALESCE(row_data.activation_fee_amount, 0), row_data.cooperation_start_date, NOW(), NOW())
      RETURNING id INTO v_customer_id;
    ELSE
      UPDATE customers
      SET
        customer_code = COALESCE(customer_code, row_data.customer_code),
        isp_name = 'PT Aplikanusa Lintasarta',
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
        'Imported from Aplikanusa spreadsheet batch',
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
WHERE c.customer_code LIKE 'CUST-APL-%'
GROUP BY c.name, ct.id, ct.contract_number, ct.start_date, ct.end_date, ct.core_type, ct.core_total, ct.sharing_ratio, ct.status
ORDER BY c.name, ct.end_date DESC;

COMMIT;
