-- Script to create Supabase Auth accounts for existing ISPs
-- Run this in Supabase SQL Editor
-- This script calls the newly created `upsert_isp_account` RPC for each ISP
-- Ensure you have run `scripts/auth/rpc-upsert-isp-account.sql` first.

-- Ensure necessary columns exist in isp_user_accounts
ALTER TABLE public.isp_user_accounts ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.isp_user_accounts ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Drop foreign key constraint on user_id if it exists so we can change the type
ALTER TABLE public.isps DROP CONSTRAINT IF EXISTS isps_user_id_fkey;

-- Ensure user_id in isps is TEXT
ALTER TABLE public.isps ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

-- Note: The default email format used here is isp.[id]@kima.local
-- SECURITY: passwords below are placeholders. Replace REPLACE_WITH_ISP_PASSWORD
-- with a strong, UNIQUE password per ISP before running, and do NOT commit the
-- real values. Rotate any password that has ever been committed or shared.

DO $$
BEGIN
  -- 1. PT Fiber Networks Indonesia (ID: 22)
  PERFORM public.upsert_isp_account(22, 'isp.22@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'PT Fiber Networks Indonesia');

  -- 2. PT Indonesia Comnets Plus (ID: 10)
  PERFORM public.upsert_isp_account(10, 'isp.10@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'PT Indonesia Comnets Plus');

  -- 3. PT Aplikanusa Lintasarta (ID: 11)
  PERFORM public.upsert_isp_account(11, 'isp.11@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'PT Aplikanusa Lintasarta');

  -- 4. PT Medialink Global Mandiri (ID: 12)
  PERFORM public.upsert_isp_account(12, 'isp.12@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'PT Medialink Global Mandiri');

  -- 5. PT Lado Tekno Parkir (ID: 20)
  PERFORM public.upsert_isp_account(20, 'isp.20@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'PT Lado Tekno Parkir');

  -- 6. PT Indonesian Satellite Corporation (PT Indosat Tbk) (ID: 21)
  PERFORM public.upsert_isp_account(21, 'isp.21@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'PT Indonesian Satellite Corporation (PT Indosat Tbk)');

  -- 7. PT Iforte Solusi Infotek (ID: 28)
  PERFORM public.upsert_isp_account(28, 'isp.28@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'PT Iforte Solusi Infotek');

  -- 8. PT Telekomunikasi Indonesia (ID: 29)
  PERFORM public.upsert_isp_account(29, 'isp.29@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'PT Telekomunikasi Indonesia');

  -- 9. PT Mora Telematika Indonesia (ID: 30)
  PERFORM public.upsert_isp_account(30, 'isp.30@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'PT Mora Telematika Indonesia');

  -- 10. PT Jenius Lintas Nusantara (ID: 31)
  PERFORM public.upsert_isp_account(31, 'isp.31@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'PT Jenius Lintas Nusantara');

  -- 11. PT Multitech Infomedia (ID: 32)
  PERFORM public.upsert_isp_account(32, 'isp.32@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'PT Multitech Infomedia');

  -- 12. PT Panca Karsa Sejahtera (ID: 33)
  PERFORM public.upsert_isp_account(33, 'isp.33@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'PT Panca Karsa Sejahtera');

  -- 13. PT Cendikia Global Solusi (ID: 4)
  PERFORM public.upsert_isp_account(4, 'isp.4@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'PT Cendikia Global Solusi');

  -- 14. PT Citra Prima Media (ID: 34)
  PERFORM public.upsert_isp_account(34, 'isp.34@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'PT Citra Prima Media');

  -- 15. PT XL Axiata Tbk (ID: 23)
  PERFORM public.upsert_isp_account(23, 'isp.23@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'PT XL Axiata Tbk');

  -- 16. PT Inet Global (ID: 36)
  PERFORM public.upsert_isp_account(36, 'isp.36@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'PT Inet Global');

  -- 17. iuwegfu (ID: 44)
  -- PERFORM public.upsert_isp_account(44, 'isp.44@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'iuwegfu');

  -- 18. kjsbdfjk (ID: 45)
  -- PERFORM public.upsert_isp_account(45, 'isp.45@kima.local', 'REPLACE_WITH_ISP_PASSWORD', 'kjsbdfjk');

  RAISE NOTICE 'Migration of existing ISP accounts completed successfully.';
END $$;
