-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('admin', 'teknisi', 'isp');

-- CreateEnum
CREATE TYPE "document_type" AS ENUM ('permohonan', 'penawaran', 'tanggapan', 'hasil_nego', 'BAK', 'kontrak', 'invoice', 'perpanjangan', 'pemutusan', 'lainnya');

-- CreateEnum
CREATE TYPE "customer_status" AS ENUM ('aktif', 'nonaktif', 'arsip', 'expired', 'berhenti');

-- CreateEnum
CREATE TYPE "contract_status" AS ENUM ('aktif', 'expired', 'terminated');

-- CreateEnum
CREATE TYPE "route_flow_status" AS ENUM ('aktif', 'nonaktif', 'gangguan');

-- CreateEnum
CREATE TYPE "route_point_type" AS ENUM ('awal', 'transit', 'tujuan');

-- CreateEnum
CREATE TYPE "invoice_status" AS ENUM ('lunas', 'belum_bayar', 'terlambat', 'belum_ditagih');

-- CreateEnum
CREATE TYPE "invoice_follow_up_status" AS ENUM ('warning', 'sent', 'completed');

-- CreateEnum
CREATE TYPE "invoice_follow_up_source" AS ENUM ('auto', 'manual', 'upload');

-- CreateEnum
CREATE TYPE "core_allocation_type" AS ENUM ('core', 'sharing_core');

-- CreateEnum
CREATE TYPE "billing_unit" AS ENUM ('hari', 'bulan', 'tahun');

-- CreateEnum
CREATE TYPE "isp_status" AS ENUM ('aktif', 'nonaktif', 'expired', 'berhenti');

-- CreateEnum
CREATE TYPE "isp_package_type" AS ENUM ('core', 'shared');

-- CreateEnum
CREATE TYPE "isp_renewal_status" AS ENUM ('active', 'warning', 'pending', 'renewed', 'terminated', 'needs_completion');

-- CreateEnum
CREATE TYPE "isp_renewal_follow_up_status" AS ENUM ('warning', 'pending_response', 'completed');

-- CreateEnum
CREATE TYPE "isp_renewal_follow_up_source" AS ENUM ('auto', 'manual', 'upload');

-- CreateEnum
CREATE TYPE "isp_renewal_response_decision" AS ENUM ('lanjut', 'tidak');

-- CreateEnum
CREATE TYPE "invoice_schedule_status" AS ENUM ('active', 'history');

-- CreateEnum
CREATE TYPE "route_change_mode" AS ENUM ('initial', 'ubah_jalur');

-- CreateEnum
CREATE TYPE "route_history_operation" AS ENUM ('add', 'update', 'delete', 'reorder', 'status', 'commit', 'replace');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "user_role" NOT NULL,
    "display_name" VARCHAR(120),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "customer_code" VARCHAR(50) NOT NULL,
    "isp_name" VARCHAR(120) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" "customer_status" NOT NULL,
    "activation_fee_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "activation_fee_paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "contract_start_date" DATE,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "isps" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "status" "isp_status" NOT NULL,
    "contract_reference" VARCHAR(120),
    "contract_start_date" DATE,
    "contract_period_start" DATE,
    "contract_period_end" DATE,
    "paket" "isp_package_type" NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "billing_period_mode" VARCHAR(30),
    "billing_custom_every" INTEGER,
    "billing_custom_unit" "billing_unit",
    "activation_fee_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "activation_fee_paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "logo_url" TEXT,
    "contract_file_name" VARCHAR(255),
    "contract_file_url" TEXT,
    "user_id" INTEGER,
    "password_plain" VARCHAR(255),

    CONSTRAINT "isps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_isp_memberships" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "isp_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_isp_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "isp_contract_rows" (
    "id" SERIAL NOT NULL,
    "isp_id" INTEGER NOT NULL,
    "contract_reference" VARCHAR(120) NOT NULL,
    "period_start" DATE,
    "period_end" DATE,
    "renewal_status" "isp_renewal_status" NOT NULL DEFAULT 'active',
    "bak_file_url" TEXT,
    "bak_file_name" VARCHAR(255),
    "renewal_file_url" TEXT,
    "renewal_file_name" VARCHAR(255),
    "response_file_url" TEXT,
    "response_file_name" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "contract_file_name" VARCHAR(255),
    "contract_file_url" TEXT,

    CONSTRAINT "isp_contract_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "isp_renewal_follow_ups" (
    "id" SERIAL NOT NULL,
    "row_id" INTEGER NOT NULL,
    "split_order" INTEGER NOT NULL,
    "source" "isp_renewal_follow_up_source" NOT NULL,
    "trigger_code" VARCHAR(120),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "isp_renewal_follow_up_status" NOT NULL,
    "renewal_file_url" TEXT,
    "renewal_file_name" VARCHAR(255),
    "response_file_url" TEXT,
    "response_file_name" VARCHAR(255),
    "response_decision" "isp_renewal_response_decision",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "isp_renewal_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "contract_number" VARCHAR(100) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "core_type" "core_allocation_type" NOT NULL,
    "core_total" INTEGER NOT NULL DEFAULT 0,
    "sharing_ratio" VARCHAR(40),
    "status" "contract_status" NOT NULL DEFAULT 'aktif',
    "billing_every" INTEGER NOT NULL DEFAULT 1,
    "billing_unit" "billing_unit" NOT NULL DEFAULT 'bulan',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_versions" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "version_number" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "core_type" "core_allocation_type" NOT NULL,
    "core_total" INTEGER NOT NULL DEFAULT 0,
    "shared_core_ratio" VARCHAR(40),
    "bak_document_id" INTEGER,
    "renewal_file_url" TEXT,
    "renewal_file_name" VARCHAR(255),
    "response_file_url" TEXT,
    "response_file_name" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contract_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_version_renewal_follow_ups" (
    "id" SERIAL NOT NULL,
    "version_id" INTEGER NOT NULL,
    "split_order" INTEGER NOT NULL,
    "source" "isp_renewal_follow_up_source" NOT NULL,
    "trigger_code" VARCHAR(120),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "isp_renewal_follow_up_status" NOT NULL,
    "renewal_file_url" TEXT,
    "renewal_file_name" VARCHAR(255),
    "response_file_url" TEXT,
    "response_file_name" VARCHAR(255),
    "response_decision" "isp_renewal_response_decision",
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contract_version_renewal_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "contract_id" INTEGER,
    "contract_version_id" INTEGER,
    "contract_number" VARCHAR(100),
    "jenis_dokumen" "document_type" NOT NULL,
    "nomor_dokumen" VARCHAR(100),
    "tanggal_dokumen" DATE NOT NULL,
    "file_url" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "invoice_number" VARCHAR(100),
    "contract_id" INTEGER,
    "contract_version_id" INTEGER,
    "contract_number" VARCHAR(100),
    "period_month" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_start_date" DATE,
    "period_end_date" DATE,
    "due_date" DATE,
    "amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "invoice_status" NOT NULL DEFAULT 'belum_ditagih',
    "schedule_version" INTEGER NOT NULL DEFAULT 1,
    "schedule_status" "invoice_schedule_status" NOT NULL DEFAULT 'active',
    "document_id" INTEGER,
    "paid_at" TIMESTAMPTZ(6),
    "invoice_file_url" TEXT,
    "payment_proof_file_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_follow_ups" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "split_order" INTEGER NOT NULL,
    "source" "invoice_follow_up_source" NOT NULL,
    "trigger_code" VARCHAR(120),
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "invoice_follow_up_status" NOT NULL,
    "invoice_number" VARCHAR(100),
    "invoice_file_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invoice_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_route_versions" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "version_number" INTEGER NOT NULL,
    "flow_status" "route_flow_status" NOT NULL,
    "change_mode" "route_change_mode" NOT NULL DEFAULT 'initial',
    "change_note" TEXT,
    "based_on_version_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_route_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_route_points" (
    "id" SERIAL NOT NULL,
    "route_version_id" INTEGER NOT NULL,
    "order_number" INTEGER NOT NULL,
    "path_name" VARCHAR(255) NOT NULL,
    "point_type" "route_point_type" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_route_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_route_history" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "operation" "route_history_operation" NOT NULL,
    "note" TEXT NOT NULL,
    "snapshot_before" JSONB NOT NULL,
    "snapshot_after" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_route_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");

-- CreateIndex
CREATE INDEX "idx_users_is_active" ON "users"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "customers_customer_code_key" ON "customers"("customer_code");

-- CreateIndex
CREATE INDEX "idx_customers_name" ON "customers"("name");

-- CreateIndex
CREATE INDEX "idx_customers_status" ON "customers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "isps_name_key" ON "isps"("name");

-- CreateIndex
CREATE UNIQUE INDEX "isps_user_id_key" ON "isps"("user_id");

-- CreateIndex
CREATE INDEX "idx_isps_status" ON "isps"("status");

-- CreateIndex
CREATE INDEX "idx_customer_isp_memberships_isp_id" ON "customer_isp_memberships"("isp_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_customer_isp_memberships_customer_isp" ON "customer_isp_memberships"("customer_id", "isp_id");

-- CreateIndex
CREATE INDEX "idx_isp_contract_rows_isp_id" ON "isp_contract_rows"("isp_id");

-- CreateIndex
CREATE INDEX "idx_isp_contract_rows_renewal_status" ON "isp_contract_rows"("renewal_status");

-- CreateIndex
CREATE INDEX "idx_isp_renewal_follow_ups_status" ON "isp_renewal_follow_ups"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_isp_renewal_follow_ups_row_split_order" ON "isp_renewal_follow_ups"("row_id", "split_order");

-- CreateIndex
CREATE UNIQUE INDEX "uq_contracts_contract_number" ON "contracts"("contract_number");

-- CreateIndex
CREATE INDEX "idx_contracts_customer_end_date" ON "contracts"("customer_id", "end_date");

-- CreateIndex
CREATE INDEX "idx_contracts_status" ON "contracts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "contract_versions_bak_document_id_key" ON "contract_versions"("bak_document_id");

-- CreateIndex
CREATE INDEX "idx_contract_versions_customer_id" ON "contract_versions"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_contract_versions_contract_version_number" ON "contract_versions"("contract_id", "version_number");

-- CreateIndex
CREATE INDEX "idx_contract_version_renewal_follow_ups_status" ON "contract_version_renewal_follow_ups"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_contract_version_renewal_follow_ups_version_split_order" ON "contract_version_renewal_follow_ups"("version_id", "split_order");

-- CreateIndex
CREATE INDEX "idx_documents_customer_date" ON "documents"("customer_id", "tanggal_dokumen" DESC);

-- CreateIndex
CREATE INDEX "idx_documents_type" ON "documents"("jenis_dokumen");

-- CreateIndex
CREATE INDEX "idx_documents_contract_id" ON "documents"("contract_id");

-- CreateIndex
CREATE INDEX "idx_documents_contract_version_id" ON "documents"("contract_version_id");

-- CreateIndex
CREATE INDEX "idx_invoices_customer_period" ON "invoices"("customer_id", "period_year", "period_month");

-- CreateIndex
CREATE INDEX "idx_invoices_contract_id" ON "invoices"("contract_id");

-- CreateIndex
CREATE INDEX "idx_invoices_contract_version_id" ON "invoices"("contract_version_id");

-- CreateIndex
CREATE INDEX "idx_invoices_status" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "idx_invoice_follow_ups_status" ON "invoice_follow_ups"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_invoice_follow_ups_invoice_split_order" ON "invoice_follow_ups"("invoice_id", "split_order");

-- CreateIndex
CREATE INDEX "idx_customer_route_versions_based_on_version_id" ON "customer_route_versions"("based_on_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_customer_route_versions_customer_version_number" ON "customer_route_versions"("customer_id", "version_number");

-- CreateIndex
CREATE INDEX "idx_customer_route_points_point_type" ON "customer_route_points"("point_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_customer_route_points_route_order_number" ON "customer_route_points"("route_version_id", "order_number");

-- CreateIndex
CREATE INDEX "idx_customer_route_history_customer_created_at" ON "customer_route_history"("customer_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "isps" ADD CONSTRAINT "isps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_isp_memberships" ADD CONSTRAINT "customer_isp_memberships_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_isp_memberships" ADD CONSTRAINT "customer_isp_memberships_isp_id_fkey" FOREIGN KEY ("isp_id") REFERENCES "isps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "isp_contract_rows" ADD CONSTRAINT "isp_contract_rows_isp_id_fkey" FOREIGN KEY ("isp_id") REFERENCES "isps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "isp_renewal_follow_ups" ADD CONSTRAINT "isp_renewal_follow_ups_row_id_fkey" FOREIGN KEY ("row_id") REFERENCES "isp_contract_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_bak_document_id_fkey" FOREIGN KEY ("bak_document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_version_renewal_follow_ups" ADD CONSTRAINT "contract_version_renewal_follow_ups_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "contract_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_contract_version_id_fkey" FOREIGN KEY ("contract_version_id") REFERENCES "contract_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contract_version_id_fkey" FOREIGN KEY ("contract_version_id") REFERENCES "contract_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_follow_ups" ADD CONSTRAINT "invoice_follow_ups_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_route_versions" ADD CONSTRAINT "customer_route_versions_based_on_version_id_fkey" FOREIGN KEY ("based_on_version_id") REFERENCES "customer_route_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_route_versions" ADD CONSTRAINT "customer_route_versions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_route_points" ADD CONSTRAINT "customer_route_points_route_version_id_fkey" FOREIGN KEY ("route_version_id") REFERENCES "customer_route_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_route_history" ADD CONSTRAINT "customer_route_history_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

