-- Add missing enum value for future-start ISP contracts.
-- Run in Supabase SQL Editor. Safe to rerun.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'isp_status'
      AND e.enumlabel = 'belum_beroperasi'
  ) THEN
    ALTER TYPE public.isp_status ADD VALUE 'belum_beroperasi';
  END IF;
END $$;
