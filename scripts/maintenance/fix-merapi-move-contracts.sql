-- ============================================================================
-- FIX: Pindahkan Contracts PT Merapi ke Customer yang Benar
-- ============================================================================
-- Tanggal: 2026-05-14
-- Issue: Contracts PT Merapi masih di customer lama, padahal customer baru sudah ada
-- Solusi: Pindahkan contracts ke customer yang sudah ada (CUST-MLK-MERAPI-001)
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_old_customer_id BIGINT;
  v_new_customer_id BIGINT;
  v_medialink_isp_id BIGINT;
  v_contract_ids BIGINT[];
BEGIN
  -- Cari customer lama (yang salah)
  SELECT id INTO v_old_customer_id
  FROM customers
  WHERE name = 'PT Merapi Utama Pharma'
    AND customer_code != 'CUST-MLK-MERAPI-001'
  ORDER BY id
  LIMIT 1;

  -- Cari customer baru (yang benar)
  SELECT id INTO v_new_customer_id
  FROM customers
  WHERE customer_code = 'CUST-MLK-MERAPI-001'
  LIMIT 1;

  -- Cari ISP Medialink
  SELECT id INTO v_medialink_isp_id
  FROM isps
  WHERE name = 'PT Medialink Global Mandiri'
  LIMIT 1;

  RAISE NOTICE '=== CUSTOMER INFO ===';
  RAISE NOTICE 'Old Customer ID: %', v_old_customer_id;
  RAISE NOTICE 'New Customer ID (correct): %', v_new_customer_id;
  RAISE NOTICE 'Medialink ISP ID: %', v_medialink_isp_id;

  -- Cek apakah customer baru sudah ada
  IF v_new_customer_id IS NULL THEN
    RAISE EXCEPTION 'Customer CUST-MLK-MERAPI-001 not found!';
  END IF;

  -- Cari semua contract PT Medialink yang masih di customer lama
  SELECT ARRAY_AGG(id) INTO v_contract_ids
  FROM contracts
  WHERE customer_id = v_old_customer_id
    AND contract_number IN (
      'KIMA.BAK-01/DBO/FO/I/2023',
      'KIMA.BAK-42/DBO/FO/VII/2024',
      'KIMA.BAK-13/DBO/FO/V/2025'
    );

  RAISE NOTICE '=== CONTRACTS TO MOVE ===';
  RAISE NOTICE 'Contract IDs: %', v_contract_ids;
  RAISE NOTICE 'Total contracts: %', COALESCE(array_length(v_contract_ids, 1), 0);

  -- Jika ada contracts yang perlu dipindahkan
  IF v_contract_ids IS NOT NULL AND array_length(v_contract_ids, 1) > 0 THEN
    -- Pindahkan contracts
    UPDATE contracts
    SET customer_id = v_new_customer_id,
        updated_at = NOW()
    WHERE id = ANY(v_contract_ids);

    RAISE NOTICE 'Moved % contracts', array_length(v_contract_ids, 1);

    -- Pindahkan contract_versions
    UPDATE contract_versions
    SET customer_id = v_new_customer_id,
        updated_at = NOW()
    WHERE contract_id = ANY(v_contract_ids);

    RAISE NOTICE 'Updated contract_versions';

    -- Pindahkan invoices
    UPDATE invoices
    SET customer_id = v_new_customer_id,
        updated_at = NOW()
    WHERE contract_id = ANY(v_contract_ids);

    RAISE NOTICE 'Updated invoices';

    -- Pindahkan documents
    UPDATE documents
    SET customer_id = v_new_customer_id
    WHERE contract_id = ANY(v_contract_ids);

    RAISE NOTICE 'Updated documents';
  ELSE
    RAISE NOTICE 'No contracts to move - they might already be in the correct customer';
  END IF;

  -- Pastikan membership sudah benar
  IF NOT EXISTS (
    SELECT 1 FROM customer_isp_memberships
    WHERE customer_id = v_new_customer_id AND isp_id = v_medialink_isp_id
  ) THEN
    INSERT INTO customer_isp_memberships (customer_id, isp_id, created_at, updated_at)
    VALUES (v_new_customer_id, v_medialink_isp_id, NOW(), NOW());
    RAISE NOTICE 'Created membership for new customer';
  ELSE
    RAISE NOTICE 'Membership already exists';
  END IF;

  -- Hapus membership lama jika tidak ada contract lagi
  IF v_old_customer_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM contracts
      WHERE customer_id = v_old_customer_id
        AND contract_number IN (
          'KIMA.BAK-01/DBO/FO/I/2023',
          'KIMA.BAK-42/DBO/FO/VII/2024',
          'KIMA.BAK-13/DBO/FO/V/2025'
        )
    ) THEN
      DELETE FROM customer_isp_memberships
      WHERE customer_id = v_old_customer_id
        AND isp_id = v_medialink_isp_id;
      RAISE NOTICE 'Deleted old membership';
    END IF;
  END IF;

  -- Verifikasi hasil
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

-- Verification Query: Tampilkan semua PT Merapi Utama Pharma
SELECT
  c.id,
  c.customer_code,
  c.name,
  c.isp_name,
  c.status,
  COUNT(DISTINCT ct.id) AS contract_count,
  COUNT(DISTINCT i.id) AS invoice_count,
  STRING_AGG(DISTINCT ct.contract_number, ', ' ORDER BY ct.contract_number) AS contract_numbers
FROM customers c
LEFT JOIN contracts ct ON ct.customer_id = c.id
LEFT JOIN invoices i ON i.customer_id = c.id
WHERE c.name = 'PT Merapi Utama Pharma'
GROUP BY c.id, c.customer_code, c.name, c.isp_name, c.status
ORDER BY c.customer_code;

COMMIT;
