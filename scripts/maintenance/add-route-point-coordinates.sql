-- ============================================================================
-- ROUTE STRUCTURED COORDINATES & GEOMETRY (FO Route Planner) — FASE 1
-- ============================================================================
-- Tujuan:
--   Menambahkan kolom terstruktur untuk koordinat titik dan geometri rute,
--   menggantikan praktik lama menyimpan koordinat sebagai teks dan metadata
--   rute (geometri/roads) sebagai base64 yang ditempel ke kolom `note`.
--
-- Sifat:
--   - ADDITIVE & NON-BREAKING: kolom baru NULLABLE; aplikasi versi sekarang
--     tetap berfungsi (masih membaca/menulis `note`). Pengisian kolom baru oleh
--     aplikasi menyusul di Fase 2 (dual-write).
--   - IDEMPOTENT: aman dijalankan ulang (IF NOT EXISTS + guard pg_constraint;
--     backfill hanya mengisi baris yang kolom barunya masih NULL).
--
-- Jalankan manual di Supabase SQL Editor setelah direview.
-- Catatan: function backfill dibuat sebagai TEMPORARY (pg_temp), otomatis
-- hilang saat sesi berakhir — tidak meninggalkan objek permanen.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BAGIAN A — SKEMA (kolom baru)
-- ----------------------------------------------------------------------------

-- customer_route_points: koordinat terstruktur per titik
ALTER TABLE public.customer_route_points
  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN public.customer_route_points.latitude  IS 'Lintang titik jalur FO (pengganti koordinat yang dulu diparse dari note).';
COMMENT ON COLUMN public.customer_route_points.longitude IS 'Bujur titik jalur FO (pengganti koordinat yang dulu diparse dari note).';

-- customer_route_versions: geometri & metadata rute per versi
ALTER TABLE public.customer_route_versions
  ADD COLUMN IF NOT EXISTS route_geometry    JSONB,
  ADD COLUMN IF NOT EXISTS road_segments     JSONB,
  ADD COLUMN IF NOT EXISTS route_source      VARCHAR(40),
  ADD COLUMN IF NOT EXISTS route_mode        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS route_profile     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS distance_meters   DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS duration_seconds  DOUBLE PRECISION;

COMMENT ON COLUMN public.customer_route_versions.route_geometry   IS 'Geometri polyline rute sebagai array [lng,lat] (GeoJSON-style). Pengganti meta base64 di note.';
COMMENT ON COLUMN public.customer_route_versions.road_segments    IS 'Daftar segmen jalan hasil Valhalla (nama, jarak, durasi).';
COMMENT ON COLUMN public.customer_route_versions.route_source     IS 'Sumber rute, mis. valhalla-local / custom-route / planner-restored.';
COMMENT ON COLUMN public.customer_route_versions.route_mode       IS 'Mode rute: valhalla (otomatis) atau manual (custom).';
COMMENT ON COLUMN public.customer_route_versions.route_profile    IS 'Profil routing: driving/cycling/foot (untuk mode valhalla).';
COMMENT ON COLUMN public.customer_route_versions.distance_meters  IS 'Total jarak rute dalam meter.';
COMMENT ON COLUMN public.customer_route_versions.duration_seconds IS 'Estimasi durasi rute dalam detik (0 untuk mode manual).';

-- CHECK constraints koordinat (NULL diperbolehkan; hanya membatasi nilai non-null)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_route_points_latitude_valid'
      AND conrelid = 'public.customer_route_points'::regclass
  ) THEN
    ALTER TABLE public.customer_route_points
      ADD CONSTRAINT customer_route_points_latitude_valid
      CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_route_points_longitude_valid'
      AND conrelid = 'public.customer_route_points'::regclass
  ) THEN
    ALTER TABLE public.customer_route_points
      ADD CONSTRAINT customer_route_points_longitude_valid
      CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- BAGIAN B — BACKFILL KOORDINAT TITIK DARI `note`
-- ----------------------------------------------------------------------------
-- displayNote pada `note` memuat pola "lat, lng" (mis. "Provider\n-5.09, 119.50"
-- atau "Valhalla Route • -5.09296, 119.50184"). Blok meta base64 dipisah dulu
-- via split_part agar regex hanya membaca bagian teks tampilan.
-- Hanya mengisi baris yang latitude-nya masih NULL (idempotent).

UPDATE public.customer_route_points AS p
SET
  latitude  = (regexp_match(split_part(p.note, '[FO_ROUTE_META]', 1), '(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)'))[1]::double precision,
  longitude = (regexp_match(split_part(p.note, '[FO_ROUTE_META]', 1), '(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)'))[2]::double precision,
  updated_at = now()
WHERE p.latitude IS NULL
  AND p.note IS NOT NULL
  AND split_part(p.note, '[FO_ROUTE_META]', 1) ~ '(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)';

-- ----------------------------------------------------------------------------
-- BAGIAN C — BACKFILL GEOMETRI/METADATA RUTE DARI BLOK META `note`
-- ----------------------------------------------------------------------------
-- Blok meta = '[FO_ROUTE_META]' + base64( JSON ). Function temporary di bawah
-- men-decode dengan aman (mengembalikan NULL bila bukan base64/JSON valid),
-- sehingga backfill tidak pernah error karena data note yang tak terduga.

CREATE OR REPLACE FUNCTION pg_temp.try_decode_route_meta(p_note text)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  seg text;
  result jsonb;
BEGIN
  IF p_note IS NULL OR position('[FO_ROUTE_META]' IN p_note) = 0 THEN
    RETURN NULL;
  END IF;

  -- Ambil segmen setelah prefix, buang semua whitespace.
  seg := regexp_replace(
           substring(p_note FROM position('[FO_ROUTE_META]' IN p_note) + length('[FO_ROUTE_META]')),
           '\s', '', 'g');

  IF seg = '' OR seg !~ '^[A-Za-z0-9+/=]+$' THEN
    RETURN NULL;
  END IF;

  result := convert_from(decode(seg, 'base64'), 'UTF8')::jsonb;
  RETURN result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

WITH meta_per_version AS (
  SELECT DISTINCT ON (p.route_version_id)
    p.route_version_id,
    pg_temp.try_decode_route_meta(p.note) AS meta
  FROM public.customer_route_points p
  WHERE p.note LIKE '%[FO_ROUTE_META]%'
    AND pg_temp.try_decode_route_meta(p.note) IS NOT NULL
  ORDER BY p.route_version_id, p.order_number ASC, p.id ASC
)
UPDATE public.customer_route_versions AS v
SET
  route_geometry   = COALESCE(v.route_geometry, mp.meta -> 'geometryCoordinates'),
  road_segments    = COALESCE(v.road_segments,  mp.meta -> 'roads'),
  route_source     = COALESCE(v.route_source,   mp.meta ->> 'source'),
  route_mode       = COALESCE(v.route_mode,     mp.meta ->> 'mode'),
  route_profile    = COALESCE(v.route_profile,  mp.meta ->> 'profile'),
  distance_meters  = COALESCE(v.distance_meters,  NULLIF(mp.meta ->> 'distance', '')::double precision),
  duration_seconds = COALESCE(v.duration_seconds, NULLIF(mp.meta ->> 'duration', '')::double precision),
  updated_at = now()
FROM meta_per_version mp
WHERE v.id = mp.route_version_id
  AND v.route_geometry IS NULL
  AND jsonb_typeof(mp.meta -> 'geometryCoordinates') = 'array';

-- ----------------------------------------------------------------------------
-- VERIFIKASI
-- ----------------------------------------------------------------------------

-- 1) Kolom baru terpasang?
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'customer_route_points'   AND column_name IN ('latitude', 'longitude'))
    OR (table_name = 'customer_route_versions' AND column_name IN (
        'route_geometry', 'road_segments', 'route_source', 'route_mode',
        'route_profile', 'distance_meters', 'duration_seconds'))
  )
ORDER BY table_name, column_name;

-- 2) Cakupan backfill koordinat titik
SELECT
  count(*) AS total_points,
  count(latitude) AS points_with_coords,
  count(*) - count(latitude) AS points_without_coords
FROM public.customer_route_points
WHERE deleted_at IS NULL;

-- 3) Cakupan backfill geometri per versi
SELECT
  count(*) AS total_versions,
  count(route_geometry) AS versions_with_geometry
FROM public.customer_route_versions
WHERE deleted_at IS NULL;
