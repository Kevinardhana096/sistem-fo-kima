-- Add ISP FO entry points and optional customer redundancy selections.
-- Run in Supabase SQL Editor. Safe to rerun.

BEGIN;

CREATE TABLE IF NOT EXISTS public.isp_entry_points (
  id BIGSERIAL PRIMARY KEY,
  isp_id BIGINT NOT NULL REFERENCES public.isps(id) ON DELETE CASCADE,
  label VARCHAR(160) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'aktif',
  description TEXT,
  capacity_note TEXT,
  fiber_type VARCHAR(80),
  core_capacity INTEGER,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

CREATE TABLE IF NOT EXISTS public.customer_isp_entry_points (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  isp_id BIGINT NOT NULL REFERENCES public.isps(id) ON DELETE CASCADE,
  isp_entry_point_id BIGINT NOT NULL REFERENCES public.isp_entry_points(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 1,
  role VARCHAR(32) NOT NULL DEFAULT 'utama',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'isp_entry_points_latitude_valid'
      AND conrelid = 'public.isp_entry_points'::regclass
  ) THEN
    ALTER TABLE public.isp_entry_points
      ADD CONSTRAINT isp_entry_points_latitude_valid
      CHECK (latitude >= -90 AND latitude <= 90);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'isp_entry_points_longitude_valid'
      AND conrelid = 'public.isp_entry_points'::regclass
  ) THEN
    ALTER TABLE public.isp_entry_points
      ADD CONSTRAINT isp_entry_points_longitude_valid
      CHECK (longitude >= -180 AND longitude <= 180);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'isp_entry_points_status_allowed'
      AND conrelid = 'public.isp_entry_points'::regclass
  ) THEN
    ALTER TABLE public.isp_entry_points
      ADD CONSTRAINT isp_entry_points_status_allowed
      CHECK (status IN ('aktif', 'nonaktif', 'draft'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'isp_entry_points_core_capacity_valid'
      AND conrelid = 'public.isp_entry_points'::regclass
  ) THEN
    ALTER TABLE public.isp_entry_points
      ADD CONSTRAINT isp_entry_points_core_capacity_valid
      CHECK (core_capacity IS NULL OR core_capacity >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_isp_entry_points_priority_valid'
      AND conrelid = 'public.customer_isp_entry_points'::regclass
  ) THEN
    ALTER TABLE public.customer_isp_entry_points
      ADD CONSTRAINT customer_isp_entry_points_priority_valid
      CHECK (priority >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_isp_entry_points_role_allowed'
      AND conrelid = 'public.customer_isp_entry_points'::regclass
  ) THEN
    ALTER TABLE public.customer_isp_entry_points
      ADD CONSTRAINT customer_isp_entry_points_role_allowed
      CHECK (role IN ('utama', 'backup', 'cadangan'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_isp_entry_points_isp_id
  ON public.isp_entry_points(isp_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_isp_entry_points_isp_status
  ON public.isp_entry_points(isp_id, status, is_default DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_isp_entry_points_customer
  ON public.customer_isp_entry_points(customer_id, priority)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_isp_entry_points_isp
  ON public.customer_isp_entry_points(isp_id, isp_entry_point_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_isp_entry_points_active
  ON public.customer_isp_entry_points(customer_id, isp_entry_point_id)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE public.isp_entry_points IS 'FO entry points owned by an ISP for routing into KIMA.';
COMMENT ON TABLE public.customer_isp_entry_points IS 'Optional customer selection of ISP FO entry points, including redundancy priority.';

ALTER TABLE public.isp_entry_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_isp_entry_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read ISP entry points" ON public.isp_entry_points;
CREATE POLICY "Authenticated users can read ISP entry points"
  ON public.isp_entry_points
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage ISP entry points" ON public.isp_entry_points;
CREATE POLICY "Authenticated users can manage ISP entry points"
  ON public.isp_entry_points
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read customer ISP entry points" ON public.customer_isp_entry_points;
CREATE POLICY "Authenticated users can read customer ISP entry points"
  ON public.customer_isp_entry_points
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage customer ISP entry points" ON public.customer_isp_entry_points;
CREATE POLICY "Authenticated users can manage customer ISP entry points"
  ON public.customer_isp_entry_points
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMIT;
