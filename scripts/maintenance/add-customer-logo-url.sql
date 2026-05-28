-- Add logo_url column to customers table (optional)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN customers.logo_url IS 'URL logo perusahaan lokasi (opsional). Digunakan sebagai marker Titik B di peta planner.';
