-- ============================================================================
-- FIX: Pisahkan PT Merapi Utama Pharma menjadi 2 Customer Terpisah
-- ============================================================================
-- Tanggal: 2026-05-14
-- Issue: PT Merapi berlangganan dengan 2 ISP berbeda (Cendikia + Medialink)
--        tetapi hanya ada 1 customer record, sehingga di monitoring muncul 1 baris
-- Solusi: Buat customer baru untuk PT Cendikia, pisahkan contracts
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_current_customer_id BIGINT := 32; -- CUST-MLK-MERAPI-001
  v_new_cendikia_customer_id BIGINT;
  v_cendikia_isp_id BIGINT := 4;
  v_medialink_isp_id BIGINT := 12;
  v_cendikia_contract_ids BIGINT[];
BEGIN
  RAISE NOTICE '=== STEP 1: Identifikasi Contracts ===';

  -- Cari contracts yang belong to PT Cendikia
  SELECT ARRAY_AGG(id) INTO v_cendikia_contract_ids
  FROM contracts
  WHERE customer_id = v_current_customer_id
    AND contract_number = 'KIMA.BAK-54/DBO/FO/XI/2025';

  RAISE NOTICE 'Cendikia contracts to move: %', v_cendikia_contract_ids;

  -- Jika ada contracts untuk Cendikia, buat customer baru
  IF v_cendikia_contract_ids IS NOT NULL AND array_length(v_cendikia_contract_ids, 1) > 0 THEN
    RAISE NOTICE '=== STEP 2: Buat Customer Baru untuk PT Cendikia ===';

    -- Buat customer baru untuk PT Cendikia
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
    SELECT
      'CUST-CGS-MERAPI-001',
      'PT Cendikia Global Solusi',
      name,
      status,
      activation_fee_amount,
      contract_start_date,
      NOW(),
      NOW()
    FROM customers
    WHERE id = v_current_customer_id
    RETURNING id INTO v_new_cendikia_customer_id;

    RAISE NOTICE 'New Cendikia customer ID: %', v_new_cendikia_customer_id;

    RAISE NOTICE '=== STEP 3: Pindahkan Contracts ke Customer Baru ===';

    -- Pindahkan contracts
    UPDATE contracts
    SET customer_id = v_new_cendikia_customer_id,
        updated_at = NOW()
    WHERE id = ANY(v_cendikia_contract_ids);

    RAISE NOTICE 'Moved % contracts', array_length(v_cendikia_contract_ids, 1);

    -- Pindahkan contract_versions
    UPDATE contract_versions
    SET customer_id = v_new_cendikia_customer_id,
        updated_at = NOW()
    WHERE contract_id = ANY(v_cendikia_contract_ids);

    -- Pindahkan invoices
    UPDATE invoices
    SET customer_id = v_new_cendikia_customer_id,
        updated_at = NOW()
    WHERE contract_id = ANY(v_cendikia_contract_ids);

    -- Pindahkan documents
    UPDATE documents
    SET customer_id = v_new_cendikia_customer_id
    WHERE contract_id = ANY(v_cendikia_contract_ids);

    RAISE NOTICE '=== STEP 4: Update Memberships ===';

    -- Hapus membership Cendikia dari customer lama
    DELETE FROM customer_isp_memberships
    WHERE customer_id = v_current_customer_id
      AND isp_id = v_cendikia_isp_id;

    -- Tambahkan membership Cendikia ke customer baru
    INSERT INTO customer_isp_memberships (customer_id, isp_id, created_at, updated_at)
    VALUES (v_new_cendikia_customer_id, v_cendikia_isp_id, NOW(), NOW());

    RAISE NOTICE 'Updated memberships';
  ELSE
    RAISE NOTICE 'No Cendikia contracts found - customer already separated or all contracts are Medialink';
  END IF;

  RAISE NOTICE '=== VERIFICATION ===';
  RAISE NOTICE 'Medialink customer (ID %): % contracts', v_current_customer_id, (
    SELECT COUNT(*) FROM contracts WHERE customer_id = v_current_customer_id
  );
  RAISE NOTICE 'Cendikia customer (ID %): % contracts', v_new_cendikia_customer_id, (
    SELECT COUNT(*) FROM contracts WHERE customer_id = v_new_cendikia_customer_id
  );

END $$;

-- Verification Query: Tampilkan semua PT Merapi Utama Pharma
SELECT
  c.id,
  c.customer_code,
  c.name,
  c.isp_name,
  COUNT(DISTINCT ct.id) AS contract_count,
  COUNT(DISTINCT i.id) AS invoice_count,
  STRING_AGG(DISTINCT ct.contract_number, ', ' ORDER BY ct.contract_number) AS contract_numbers
FROM customers c
LEFT JOIN contracts ct ON ct.customer_id = c.id
LEFT JOIN invoices i ON i.customer_id = c.id
WHERE c.name = 'PT Merapi Utama Pharma'
GROUP BY c.id, c.customer_code, c.name, c.isp_name
ORDER BY c.customer_code;

COMMIT;
