-- Add missing enum value for future-start customer/location contracts.
-- Run in Supabase SQL Editor. Safe to rerun.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e 
l = 'belum_beroperasi'
  ) THEN
    ALTER TYPE public.customer_status ADD VALUE 'belum_beroperasi';
  END IF;
END $$;
