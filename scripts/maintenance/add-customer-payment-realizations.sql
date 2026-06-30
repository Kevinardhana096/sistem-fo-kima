-- Add manual tenant payment realization storage.
-- Run in Supabase SQL Editor. Safe to rerun.

BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_payment_realizations (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  contract_id BIGINT REFERENCES public.contracts(id) ON DELETE SET NULL,
  contract_version_id BIGINT REFERENCES public.contract_versions(id) ON DELETE SET NULL,
  period_start_month DATE NOT NULL,
  period_end_month DATE NOT NULL,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payment_file_url TEXT NOT NULL,
  payment_file_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_payment_realizations_period_valid'
      AND conrelid = 'public.customer_payment_realizations'::regclass
  ) THEN
    ALTER TABLE public.customer_payment_realizations
      ADD CONSTRAINT customer_payment_realizations_period_valid
      CHECK (period_end_month >= period_start_month);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'customer_payment_realizations_amount_valid'
      AND conrelid = 'public.customer_payment_realizations'::regclass
  ) THEN
    ALTER TABLE public.customer_payment_realizations
      ADD CONSTRAINT customer_payment_realizations_amount_valid
      CHECK (amount >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_payment_realizations_customer
  ON public.customer_payment_realizations(customer_id, period_start_month DESC);

CREATE INDEX IF NOT EXISTS idx_customer_payment_realizations_contract
  ON public.customer_payment_realizations(contract_id, period_start_month DESC);

CREATE INDEX IF NOT EXISTS idx_customer_payment_realizations_version
  ON public.customer_payment_realizations(contract_version_id);

COMMENT ON TABLE public.customer_payment_realizations IS 'Manual realization of tenant payments, synchronized to contract monitoring.';

ALTER TABLE public.customer_payment_realizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read customer payment realizations as admin teknisi or owner isp" ON public.customer_payment_realizations;
CREATE POLICY "Read customer payment realizations as admin teknisi or owner isp"
  ON public.customer_payment_realizations
  FOR SELECT
  USING (
    (select public.get_user_role()) IN ('admin', 'teknisi')
    OR (
      (select public.get_user_role()) = 'isp'
      AND public.can_current_isp_access_customer(customer_id)
    )
  );

DROP POLICY IF EXISTS "Admin insert customer payment realizations" ON public.customer_payment_realizations;
CREATE POLICY "Admin insert customer payment realizations"
  ON public.customer_payment_realizations
  FOR INSERT
  WITH CHECK ((select public.get_user_role()) = 'admin');

DROP POLICY IF EXISTS "Admin update customer payment realizations" ON public.customer_payment_realizations;
CREATE POLICY "Admin update customer payment realizations"
  ON public.customer_payment_realizations
  FOR UPDATE
  USING ((select public.get_user_role()) = 'admin')
  WITH CHECK ((select public.get_user_role()) = 'admin');

DROP POLICY IF EXISTS "Admin delete customer payment realizations" ON public.customer_payment_realizations;
CREATE POLICY "Admin delete customer payment realizations"
  ON public.customer_payment_realizations
  FOR DELETE
  USING ((select public.get_user_role()) = 'admin');

COMMIT;
