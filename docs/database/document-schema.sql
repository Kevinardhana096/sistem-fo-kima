-- HISTORICAL REFERENCE ONLY
-- Schema ini menggambarkan bentuk lama dan tidak mewakili schema production saat ini.
-- Gunakan PRD, README, dan scripts/README.md sebagai acuan kondisi terkini.

-- Core enum for document type
CREATE TYPE document_type AS ENUM (
  'permohonan',
  'penawaran',
  'hasil_nego',
  'BAK',
  'kontrak',
  'invoice',
  'perpanjangan',
  'pemutusan',
  'lainnya'
);

-- Customer master
CREATE TABLE customers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  isp_name VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'aktif', -- aktif | nonaktif
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Contracts
CREATE TABLE contracts (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'aktif', -- aktif | expired | terminated
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  contract_id BIGINT NULL REFERENCES contracts(id) ON DELETE SET NULL,
  period_month SMALLINT NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_year SMALLINT NOT NULL,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'belum_ditagih', -- lunas | belum_bayar | terlambat | belum_ditagih
  document_id BIGINT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, period_month, period_year)
);

-- Main required documents table
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  contract_id BIGINT NULL REFERENCES contracts(id) ON DELETE SET NULL,
  jenis_dokumen document_type NOT NULL,
  nomor_dokumen VARCHAR(100) NULL,
  tanggal_dokumen DATE NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Link invoice -> document (optional reverse relationship)
ALTER TABLE invoices
  ADD CONSTRAINT fk_invoice_document
  FOREIGN KEY (document_id)
  REFERENCES documents(id)
  ON DELETE SET NULL;

-- Helpful indexes
CREATE INDEX idx_documents_customer_date ON documents(customer_id, tanggal_dokumen DESC);
CREATE INDEX idx_documents_type ON documents(jenis_dokumen);
CREATE INDEX idx_documents_contract ON documents(contract_id);
CREATE INDEX idx_contracts_customer_enddate ON contracts(customer_id, end_date);
CREATE INDEX idx_invoices_customer_period ON invoices(customer_id, period_year, period_month);
