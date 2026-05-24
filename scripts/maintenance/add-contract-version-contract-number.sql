ALTER TABLE public.contract_versions
  ADD COLUMN IF NOT EXISTS contract_number text;

COMMENT ON COLUMN public.contract_versions.contract_number IS
  'Nomor kontrak spesifik untuk versi/perpanjangan kontrak pelanggan.';

UPDATE public.contract_versions
SET contract_number = 'KIMA.BAK-42/DBO/FO/IX/2023'
WHERE start_date = DATE '2023-07-08'
  AND end_date = DATE '2024-07-07'
  AND contract_id IN (
    SELECT c.id
    FROM public.contracts c
    JOIN public.customers cu ON cu.id = c.customer_id
    WHERE cu.name = 'PT Bank Tabungan Negara (Persero)'
  );

UPDATE public.contract_versions
SET contract_number = 'KIMA.BAK-38/DBO/FO/VI/2024'
WHERE start_date = DATE '2024-07-08'
  AND end_date = DATE '2025-07-07'
  AND contract_id IN (
    SELECT c.id
    FROM public.contracts c
    JOIN public.customers cu ON cu.id = c.customer_id
    WHERE cu.name = 'PT Bank Tabungan Negara (Persero)'
  );

UPDATE public.contract_versions
SET contract_number = 'KIMA-BAK-32/DBO/FO/VII/2025'
WHERE start_date = DATE '2025-07-08'
  AND end_date = DATE '2026-07-07'
  AND contract_id IN (
    SELECT c.id
    FROM public.contracts c
    JOIN public.customers cu ON cu.id = c.customer_id
    WHERE cu.name = 'PT Bank Tabungan Negara (Persero)'
  );
