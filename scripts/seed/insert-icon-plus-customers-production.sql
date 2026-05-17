-- ============================================================================
-- UPSERT DATA CUSTOMER PT INDONESIA COMNETS PLUS (ICON+) - PRODUCTION
-- ============================================================================
-- Tanggal: 2026-05-13
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
      ('CUST-ICON-CORE16-001', 'PT Indonesia Comnets Plus (16 Core)', DATE '2022-12-05', DATE '2022-12-05', DATE '2023-12-04', 'core', 16, NULL, 'KIMA.BAK-13/DBO/FO/IV/2023', '085/INV.FO/XII/2022', 'lunas', 48000000::numeric, 576000000::numeric, NULL::numeric),
      ('CUST-ICON-CORE16-001', 'PT Indonesia Comnets Plus (16 Core)', DATE '2022-12-05', DATE '2023-12-05', DATE '2024-12-04', 'core', 16, NULL, 'KIMA.BAK-13/DBO/FO/IV/2023', 'INV-007/KIMA/FO/II/2024', 'lunas', 56000000::numeric, 672000000::numeric, NULL::numeric),
      ('CUST-ICON-CORE16-001', 'PT Indonesia Comnets Plus (16 Core)', DATE '2022-12-05', DATE '2024-12-05', DATE '2025-12-04', 'core', 16, NULL, 'KIMA.BAK-13/DBO/FO/IV/2023', 'INV-003/KIMA/FO/I/2025', 'lunas', 64000000::numeric, 768000000::numeric, NULL::numeric),
      ('CUST-ICON-CORE16-001', 'PT Indonesia Comnets Plus (16 Core)', DATE '2022-12-05', DATE '2025-12-05', DATE '2026-12-04', 'core', 16, NULL, 'KIMA.BAK-13/DBO/FO/IV/2023', 'ICON-CORE16-2025', 'lunas', 80000000::numeric, 960000000::numeric, NULL::numeric),

      ('CUST-ICON-INDOSAT-KIMA-001', 'PT Indonesia Comnets Plus (Indosat KIMA)', DATE '2024-09-16', DATE '2024-09-16', DATE '2025-09-15', 'core', 2, NULL, 'SP2K. No. 4500024039', 'INV-102/KIMA/FO/XII/2024', 'lunas', 8000000::numeric, 96000000::numeric, 2500000::numeric),
      ('CUST-ICON-INDOSAT-KIMA-001', 'PT Indonesia Comnets Plus (Indosat KIMA)', DATE '2024-09-16', DATE '2025-09-16', DATE '2026-09-15', 'core', 2, NULL, 'SP2K. No. 4500024039 (terbaru)', '103/FO/II/25', 'belum_ditagih', 10000000::numeric, 120000000::numeric, NULL::numeric),

      ('CUST-ICON-INDOSAT-KENDARI-001', 'PT Indonesia Comnets Plus (Indosat Kendari)', DATE '2024-11-01', DATE '2024-11-01', DATE '2025-10-31', 'core', 2, NULL, 'SP2K. No. 4500024160', 'INV-005/KIMA/FO/I/2025', 'lunas', 8000000::numeric, 96000000::numeric, NULL::numeric),
      ('CUST-ICON-INDOSAT-KENDARI-001', 'PT Indonesia Comnets Plus (Indosat Kendari)', DATE '2024-11-01', DATE '2025-11-01', DATE '2026-10-31', 'core', 2, NULL, 'SP2K No. 4500024160', '001/FO/1/26', 'lunas', 10000000::numeric, 120000000::numeric, NULL::numeric),

      ('CUST-ICON-ASTRA-001', 'PT Astra International (ICON+)', DATE '2022-06-17', DATE '2022-06-17', DATE '2023-06-16', 'sharing_core', 0, '1/32', '-', '075/INV.FO/XII/2022', 'lunas', 250000::numeric, 3000000::numeric, NULL::numeric),
      ('CUST-ICON-ASTRA-001', 'PT Astra International (ICON+)', DATE '2022-06-17', DATE '2023-06-17', DATE '2024-06-16', 'sharing_core', 0, '1/32', 'KIMA.BAK-23/DBO/FO/V/2023', '154/INV.FO/VII/2023', 'lunas', 250000::numeric, 3000000::numeric, NULL::numeric),
      ('CUST-ICON-ASTRA-001', 'PT Astra International (ICON+)', DATE '2022-06-17', DATE '2024-06-17', DATE '2025-06-16', 'sharing_core', 0, '1/32', 'KIMA.BAK-13/DBO/FO/V/2024', 'INV-064/KIMA/FO/VII/2024', 'lunas', 250000::numeric, 3000000::numeric, NULL::numeric),
      ('CUST-ICON-ASTRA-001', 'PT Astra International (ICON+)', DATE '2022-06-17', DATE '2025-06-17', DATE '2026-06-16', 'sharing_core', 0, '1/32', 'SP2K.No. 4500023042', 'INV-061/KIMA/FO/VI/2025', 'lunas', 275000::numeric, 3300000::numeric, NULL::numeric),

      ('CUST-ICON-BINA-001', 'PT Bina Agung Cipta Bersama (ICON+)', DATE '2022-12-02', DATE '2022-12-02', DATE '2023-12-01', 'sharing_core', 0, '1/32', '-', '072/INV.FO/XII/2022', 'lunas', 250000::numeric, 3000000::numeric, 2500000::numeric),
      ('CUST-ICON-BINA-001', 'PT Bina Agung Cipta Bersama (ICON+)', DATE '2022-12-02', DATE '2023-12-02', DATE '2024-12-01', 'sharing_core', 0, '1/32', 'KIMA.BAK-03/DBO/FO/I/.2024', 'INV-006/KIMA/FO/II/2024', 'lunas', 250000::numeric, 3000000::numeric, NULL::numeric),
      ('CUST-ICON-BINA-001', 'PT Bina Agung Cipta Bersama (ICON+)', DATE '2022-12-02', DATE '2024-12-02', DATE '2025-12-01', 'sharing_core', 0, '1/32', 'SP2K No. 4500021668', 'INV-033/KIMA/FO/III/2025', 'lunas', 275000::numeric, 3300000::numeric, NULL::numeric),
      ('CUST-ICON-BINA-001', 'PT Bina Agung Cipta Bersama (ICON+)', DATE '2022-12-02', DATE '2025-12-02', DATE '2026-12-01', 'sharing_core', 0, '1/32', 'SP2K No. 4500026788', '003/FO/1/26', 'lunas', 275000::numeric, 3300000::numeric, NULL::numeric),

      ('CUST-ICON-CHAROEN-001', 'PT Charoen Pokphand Indonesia (ICON+)', DATE '2022-11-20', DATE '2022-11-20', DATE '2023-11-19', 'sharing_core', 0, '1/16', '-', '088/INV.FO/XII/2022', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-ICON-CHAROEN-001', 'PT Charoen Pokphand Indonesia (ICON+)', DATE '2022-11-20', DATE '2023-11-20', DATE '2024-11-19', 'sharing_core', 0, '1/16', 'KIMA.BAK-01/DBO/FO/I/2024', 'INV-008/KIMA/FO/III/2024', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-ICON-CHAROEN-001', 'PT Charoen Pokphand Indonesia (ICON+)', DATE '2022-11-20', DATE '2024-11-20', DATE '2025-11-19', 'sharing_core', 0, '1/16', 'SP2K No. 4500022178', 'INV-004/KIMA/FO/I/2025', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-ICON-CHAROEN-001', 'PT Charoen Pokphand Indonesia (ICON+)', DATE '2022-11-20', DATE '2025-11-25', DATE '2026-11-24', 'sharing_core', 0, '1/16', 'SP2K No. 4500026821', '004/FO/1/26', 'lunas', 550000::numeric, 6600000::numeric, NULL::numeric),

      ('CUST-ICON-INDOMARCO-001', 'PT Indomarco Prismatama (ICON+)', DATE '2023-12-28', DATE '2023-12-28', DATE '2024-12-27', 'sharing_core', 0, '1/16', 'KIMA.BAK-36/DBO/FO/VIII/2023', '177/INV.FO/IX/2023', 'lunas', 500000::numeric, 6000000::numeric, 2500000::numeric),
      ('CUST-ICON-INDOMARCO-001', 'PT Indomarco Prismatama (ICON+)', DATE '2023-12-28', DATE '2024-12-28', DATE '2025-12-27', 'sharing_core', 0, '1/16', 'KIMA.BAK-48/DBO/FO/VII/2024', 'INV-081/KIMA/FO/X/2024', 'lunas', 550000::numeric, 6600000::numeric, NULL::numeric),
      ('CUST-ICON-INDOMARCO-001', 'PT Indomarco Prismatama (ICON+)', DATE '2023-12-28', DATE '2025-12-28', DATE '2026-12-27', 'sharing_core', 0, '1/16', 'SP2K No.4500026783', '002/FO/1/26', 'lunas', 550000::numeric, 6600000::numeric, NULL::numeric),

      ('CUST-ICON-IDMKASIR-001', 'PT Indomarco Prismatama (IDM Kasir)', DATE '2024-05-17', DATE '2024-05-17', DATE '2025-05-16', 'sharing_core', 0, '1/16', 'KIMA.BAK-14/DBO/FO/V/2024', 'INV-066/KIMA/FO/VII/2024', 'lunas', 500000::numeric, 6000000::numeric, 2500000::numeric),
      ('CUST-ICON-IDMKASIR-001', 'PT Indomarco Prismatama (IDM Kasir)', DATE '2024-05-17', DATE '2025-05-17', DATE '2026-05-16', 'sharing_core', 0, '1/16', 'SP2K. No. 4500023043', 'INV.042/KIMA/FO/VI/2025', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),

      ('CUST-ICON-MALINDO-001', 'PT Malindo Feedmil (ICON+)', DATE '2023-04-28', DATE '2023-04-28', DATE '2023-12-27', 'sharing_core', 0, '1/32', 'KIMA.BAK-15/DBO/FO/IV/2023', '108/INV.FO/V/2023', 'lunas', 250000::numeric, 3000000::numeric, NULL::numeric),
      ('CUST-ICON-MALINDO-001', 'PT Malindo Feedmil (ICON+)', DATE '2023-04-28', DATE '2023-12-28', DATE '2024-12-27', 'sharing_core', 0, '1/32', 'KIMA.BAK-18/DBO/FO/VI/2024', 'INV-016/KIMA/FO/VI/2024', 'lunas', 250000::numeric, 3000000::numeric, NULL::numeric),
      ('CUST-ICON-MALINDO-001', 'PT Malindo Feedmil (ICON+)', DATE '2023-04-28', DATE '2024-12-28', DATE '2025-12-27', 'sharing_core', 0, '1/32', 'SP2K No. 4500022654', 'INV-041/KIMA/FO/VI/2025', 'lunas', 275000::numeric, 2200000::numeric, NULL::numeric),
      ('CUST-ICON-MALINDO-001', 'PT Malindo Feedmil (ICON+)', DATE '2023-04-28', DATE '2025-12-28', DATE '2026-12-27', 'sharing_core', 0, '1/32', 'SP2K No. 4500026819', '006/FO/1/26', 'lunas', 275000::numeric, 3300000::numeric, NULL::numeric),

      ('CUST-ICON-MARS-001', 'PT Mars Symbioscience Indonesia (ICON+)', DATE '2022-12-12', DATE '2022-12-12', DATE '2023-12-11', 'sharing_core', 0, '1/16', '-', '044/INV.FO/X/2022', 'lunas', 500000::numeric, 6000000::numeric, 2500000::numeric),
      ('CUST-ICON-MARS-001', 'PT Mars Symbioscience Indonesia (ICON+)', DATE '2022-12-12', DATE '2023-12-12', DATE '2024-12-11', 'sharing_core', 0, '1/16', 'KIMA.BAK-37/DBO/FO/VIII/2023', '176/INV.FO/IX/2023', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-ICON-MARS-001', 'PT Mars Symbioscience Indonesia (ICON+)', DATE '2022-12-12', DATE '2024-12-12', DATE '2025-12-11', 'sharing_core', 0, '1/16', 'SP2K No. 4500021668', 'INV-006/KIMA/FO/I/2025', 'lunas', 550000::numeric, 8250000::numeric, NULL::numeric),
      ('CUST-ICON-MARS-001', 'PT Mars Symbioscience Indonesia (ICON+)', DATE '2022-12-12', DATE '2025-12-12', DATE '2026-12-11', 'sharing_core', 0, '1/16', 'SP2K No. 450026841', '007/FO/1/26', 'lunas', 550000::numeric, 6600000::numeric, NULL::numeric),

      ('CUST-ICON-SAT-001', 'PT Sumber Alfaria Trijaya (ICON+)', DATE '2023-01-23', DATE '2023-01-23', DATE '2024-01-22', 'sharing_core', 0, '1/16', '-', '099/INV.FO/III/2023', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-ICON-SAT-001', 'PT Sumber Alfaria Trijaya (ICON+)', DATE '2023-01-23', DATE '2024-01-23', DATE '2025-01-22', 'sharing_core', 0, '1/16', 'KIMA.BAK-04/DBO/FO/I/2024', 'INV-009/KIMA/FO/III/2024', 'lunas', 500000::numeric, 6000000::numeric, NULL::numeric),
      ('CUST-ICON-SAT-001', 'PT Sumber Alfaria Trijaya (ICON+)', DATE '2023-01-23', DATE '2025-01-23', DATE '2026-01-22', 'sharing_core', 0, '1/16', 'SP2K No. 4500022163', 'INV.040/KIMA/FO/VI/2025', 'lunas', 550000::numeric, 6600000::numeric, NULL::numeric),
      ('CUST-ICON-SAT-001', 'PT Sumber Alfaria Trijaya (ICON+)', DATE '2023-01-23', DATE '2026-01-23', DATE '2027-01-22', 'sharing_core', 0, '1/16', 'SP2K No. 4500022163', '018/FO/4/26', 'belum_ditagih', 550000::numeric, 6600000::numeric, NULL::numeric),

      ('CUST-ICON-WIKA-BETON-001', 'PT Wijaya Karya Beton (ICON+)', DATE '2022-11-28', DATE '2022-11-28', DATE '2023-05-27', 'sharing_core', 0, '1/32', '-', '071/INV.FO/XII/2022', 'lunas', 250000::numeric, 3000000::numeric, 2500000::numeric),
      ('CUST-ICON-WIKA-BETON-001', 'PT Wijaya Karya Beton (ICON+)', DATE '2022-11-28', DATE '2023-11-28', DATE '2024-05-27', 'sharing_core', 0, '1/32', 'KIMA.BAK-02/DBO/FO/I/2024', 'INV-005/KIMA/FO/II/2024', 'lunas', 250000::numeric, 3000000::numeric, NULL::numeric),
      ('CUST-ICON-WIKA-BETON-001', 'PT Wijaya Karya Beton (ICON+)', DATE '2022-11-28', DATE '2024-11-28', DATE '2025-05-27', 'sharing_core', 0, '1/32', 'SP2K No. 4500021625', 'INV-032/KIMA/FO/III/2025', 'lunas', 275000::numeric, 3300000::numeric, NULL::numeric),
      ('CUST-ICON-WIKA-BETON-001', 'PT Wijaya Karya Beton (ICON+)', DATE '2022-11-28', DATE '2025-11-28', DATE '2026-05-27', 'sharing_core', 0, '1/32', 'SP2K No. 4500026818', '005/FO/1/26', 'lunas', 275000::numeric, 1650000::numeric, NULL::numeric),

      ('CUST-ICON-INDOROTI-001', 'PT Indoroti Prima Cemerlang (ICON+)', DATE '2023-08-28', DATE '2023-08-28', DATE '2024-12-27', 'sharing_core', 0, '1/32', 'KIMA.BAK-35/DBO/FO/VIII/2023', '177/INV.FO/IX/2023', 'lunas', 250000::numeric, 3000000::numeric, 2500000::numeric),
      ('CUST-ICON-INDOROTI-001', 'PT Indoroti Prima Cemerlang (ICON+)', DATE '2023-08-28', DATE '2024-08-28', DATE '2025-12-27', 'sharing_core', 0, '1/32', 'KIMA.BAK-47/DBO/FO/VII/2024', 'INV-081/KIMA/FO/X/2024', 'lunas', 275000::numeric, 4400000::numeric, NULL::numeric),
      ('CUST-ICON-INDOROTI-001', 'PT Indoroti Prima Cemerlang (ICON+)', DATE '2023-08-28', DATE '2025-08-28', DATE '2026-12-27', 'sharing_core', 0, '1/32', 'SP2K No. 4500026783', '002/FO/1/26', 'lunas', 275000::numeric, 3300000::numeric, NULL::numeric),

      ('CUST-ICON-ANDIARTA-001', 'PT Andiarta Muzizat (ICON+)', DATE '2023-09-25', DATE '2023-09-25', DATE '2024-09-24', 'sharing_core', 0, '1/16', 'KIMA.BAK-40/DBO/FO/IX/2023', '185/INV.FO/XI/2023', 'lunas', 500000::numeric, 6000000::numeric, 2500000::numeric),
      ('CUST-ICON-ANDIARTA-001', 'PT Andiarta Muzizat (ICON+)', DATE '2023-09-25', DATE '2024-09-25', DATE '2025-09-24', 'sharing_core', 0, '1/16', 'SP2K No. 4500023781', 'INV-104/KIMA/FO/XII/2024', 'lunas', 550000::numeric, 6600000::numeric, NULL::numeric),
      ('CUST-ICON-ANDIARTA-001', 'PT Andiarta Muzizat (ICON+)', DATE '2023-09-25', DATE '2025-09-25', DATE '2026-09-24', 'sharing_core', 0, '1/16', 'SP2K No. 4500023781', '102/FO/11/25', 'belum_ditagih', 550000::numeric, 6600000::numeric, NULL::numeric),

      ('CUST-ICON-EASTLYNC-001', 'PT Eastlync Technology Indonesia (ICON+)', DATE '2025-07-14', DATE '2025-07-14', DATE '2026-07-13', 'sharing_core', 0, '1/16', 'SP2K No. 4500025809', '101/FO/11/25', 'lunas', 550000::numeric, 6600000::numeric, 2500000::numeric)
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
      VALUES (row_data.customer_code, 'PT Indonesia Comnets Plus', row_data.customer_name, 'aktif', COALESCE(row_data.activation_fee_amount, 0), row_data.cooperation_start_date, NOW(), NOW())
      RETURNING id INTO v_customer_id;
    ELSE
      UPDATE customers
      SET
        customer_code = COALESCE(customer_code, row_data.customer_code),
        isp_name = 'PT Indonesia Comnets Plus',
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
        'Imported from ICON+ spreadsheet batch',
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
WHERE c.customer_code LIKE 'CUST-ICON-%'
GROUP BY c.name, ct.id, ct.contract_number, ct.start_date, ct.end_date, ct.core_type, ct.core_total, ct.sharing_ratio, ct.status
ORDER BY c.name, ct.end_date DESC;

COMMIT;
