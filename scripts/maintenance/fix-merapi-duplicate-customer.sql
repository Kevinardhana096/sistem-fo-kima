-- ============================================================================
-- FIX: Pisahkan PT Merapi Utama Pharma untuk PT Medialink Global Mandiri
-- ============================================================================
-- Tanggal: 2026-05-14
-- Issue: PT Merapi Utama Pharma muncul di multiple ISP dalam 1 baris monitoring
-- Solusi: Buat customer baru khusus untuk PT Medialink
-- ============================================================================

BEGIN;

-- Step 1: Identifikasi customer yang bermasalah
DO $$
DECLARE
  v_old_customer_id BIGINT;
  v_new_customer_id BIGINT;
  v_medialink_isp_id BIGINT;
  v_contract_ids BIGINT[];
BEGIN
  -- Cari customer lama
  SELECT id INTO v_old_customer_id
  FROM customers
  WHERE name = 'PT Merapi Utama Pharma'
  ORDER BY id
  LIMIT 1;

  -- Cari ISP Medialink
  SELECT id INTO v_medialink_isp_id
  FROM isps
  WHERE name = 'PT Medialink Global Mandiri'
  LIMIT 1;

  RAISE NOTICE 'Old Customer ID: %', v_old_customer_id;
  RAISE NOTICE 'Medialink ISP ID: %', v_medialink_isp_id;

  -- Step 2: Buat customer baru untuk PT Medialink
  INSERT INTO customers (
    customer_code,
    isp_name,
    name,
    status,
    activation_fee_amount,
    contract_start_date,
    created_at,
    updated_at
  )
  VALUES (
    'CUST-MLK-MERAPI-001',
    'PT Medialink Global Mandiri',
    'PT Merapi Utama Pharma',
    'aktif',
    2500000,
    '2023-01-26',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_new_customer_id;

  RAISE NOTICE 'New Customer ID: %', v_new_customer_id;

  -- Step 3: Cari semua contract yang harus dipindahkan
  SELECT ARRAY_AGG(id) INTO v_contract_ids
  FROM contracts
  WHERE customer_id = v_old_customer_id
    AND contract_number IN (
      'KIMA.BAK-01/DBO/FO/I/2023',
      'KIMA.BAK-42/DBO/FO/VII/2024',
      'KIMA.BAK-13/DBO/FO/V/2025'
    );

  RAISE NOTICE 'Contracts to move: %', v_contract_ids;

  -- Step 4: Pindahkan contracts
  UPDATE contracts
  SET customer_id = v_new_customer_id,
      updated_at = NOW()
  WHERE id = ANY(v_contract_ids);

  RAISE NOTICE 'Moved % contracts', array_length(v_contract_ids, 1);

  -- Step 5: Pindahkan contract_versions
  UPDATE contract_versions
  SET customer_id = v_new_customer_id,
      updated_at = NOW()
  WHERE contract_id = ANY(v_contract_ids);

  RAISE NOTICE 'Updated contract_versions';

  -- Step 6: Pindahkan invoices
  UPDATE invoices
  SET customer_id = v_new_customer_id,
      updated_at = NOW()
  WHERE contract_id = ANY(v_contract_ids);

  RAISE NOTICE 'Updated invoices';

  -- Step 7: Pindahkan documents
  UPDATE documents
  SET customer_id = v_new_customer_id
  WHERE contract_id = ANY(v_contract_ids);

  RAISE NOTICE 'Updated documents';

  -- Step 8: Hapus membership lama dari Medialink (jika ada)
  DELETE FROM customer_isp_memberships
  WHERE customer_id = v_old_customer_id
    AND isp_id = v_medialink_isp_id;

  RAISE NOTICE 'Deleted old membership';

  -- Step 9: Tambahkan membership baru
  INSERT INTO customer_isp_memberships (customer_id, isp_id, created_at, updated_at)
  VALUES (v_new_customer_id, v_medialink_isp_id, NOW(), NOW())
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Created new membership';

  -- Step 10: Verifikasi hasil
  RAISE NOTICE '=== VERIFICATION ===';
  RAISE NOTICE 'Old customer contracts remaining: %', (
    SELECT COUNT(*) FROM contracts WHERE customer_id = v_old_customer_id
  );
  RAISE NOTICE 'New customer contracts: %', (
    SELECT COUNT(*) FROM contracts WHERE customer_id = v_new_customer_id
  );
  RAISE NOTICE 'New customer invoices: %', (
    SELECT COUNT(*) FROM invoices WHERE customer_id = v_new_customer_id
  );

END $$;

-- Verification Query
SELECT
  c.id,
  c.customer_code,
  c.name,
  c.isp_name,
  c.status,
  COUNT(DISTINCT ct.id) AS contract_count,
  COUNT(DISTINCT i.id) AS invoice_count,
  STRING_AGG(DISTINCT ct.contract_number, ', ') AS contract_numbers
FROM customers c
LEFT JOIN contracts ct ON ct.customer_id = c.id
LEFT JOIN invoices i ON i.customer_id = c.id
WHERE c.name = 'PT Merapi Utama Pharma'
GROUP BY c.id, c.customer_code, c.name, c.isp_name, c.status
ORDER BY c.id;

COMMIT;
