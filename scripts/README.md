# Scripts Sistem FO KIMA

Folder ini berisi script operasional untuk Supabase: auth/provisioning akun, Row Level Security, seed data, maintenance/koreksi data, dan helper development lokal.

> **Aturan operasional:** Script production harus **direview** dan dijalankan **manual** melalui Supabase SQL Editor. Jangan menjalankan script seed/maintenance ke database production tanpa memahami dampaknya. Script seed/upsert dirancang **idempotent** (aman dijalankan ulang) dengan kunci seperti `customer_code`, `(customer_id, contract_number)`, dan `(customer_id, invoice_number)`.

Urutan setup environment baru (ringkas): **auth users → RLS → kolom/feature schema → index → provisioning akun ISP → seed data**. Lihat [../DEV_GUIDE.md](../DEV_GUIDE.md) dan [../docs/guides/supabase-setup-guide.md](../docs/guides/supabase-setup-guide.md).

---

## `auth/` — User & Provisioning Akun

| Script | Fungsi |
| --- | --- |
| [auth/create-supabase-auth-users.sql](auth/create-supabase-auth-users.sql) | Template membuat user Supabase Auth (ganti semua placeholder `REPLACE_WITH_*`). |
| [auth/insert-admin-user-production.sql](auth/insert-admin-user-production.sql) | Insert user admin default untuk kebutuhan operasional/legacy (bertanggal). |
| [auth/rpc-create-isp-account.sql](auth/rpc-create-isp-account.sql) | RPC `create_isp_account` — membuat akun user ISP langsung dari frontend (admin only). |
| [auth/rpc-upsert-isp-account.sql](auth/rpc-upsert-isp-account.sql) | RPC `upsert_isp_account` — membuat **atau** memperbarui akun user ISP (admin only). |
| [auth/create-isp-auth-accounts-from-isps.sql](auth/create-isp-auth-accounts-from-isps.sql) | Membuat/sinkron akun Supabase Auth ISP dari credential di `public.isps` dan mapping ke `public.isp_user_accounts`. |
| [auth/migrate-existing-isps-to-auth.sql](auth/migrate-existing-isps-to-auth.sql) | Membuat akun Auth untuk ISP yang sudah ada dengan memanggil `upsert_isp_account` per ISP (butuh `rpc-upsert-isp-account.sql` lebih dulu). |
| [auth/map-isp-users.sql](auth/map-isp-users.sql) | Memetakan akun auth role ISP ke 1 entitas ISP (`1 user = 1 ISP`); jalankan setelah Auth users & RLS dibuat. |

## `rls/` — Row Level Security

| Script | Fungsi |
| --- | --- |
| [rls/setup-supabase-rls-policies.sql](rls/setup-supabase-rls-policies.sql) | Mengaktifkan dan mengatur Supabase RLS policies (termasuk tabel `public.isp_user_accounts`). |

## `maintenance/` — Schema, Index & Koreksi Data

### Kolom & fitur schema

| Script | Fungsi |
| --- | --- |
| [maintenance/add-soft-delete-columns.sql](maintenance/add-soft-delete-columns.sql) | Menambahkan kolom `deleted_at`/`deleted_by` ke seluruh tabel utama (dasar fitur Tempat Sampah / soft delete). |
| [maintenance/add-activity-logs.sql](maintenance/add-activity-logs.sql) | Membuat tabel `activity_logs` (audit trail) untuk fitur Log Aktivitas. |
| [maintenance/add-notification-states.sql](maintenance/add-notification-states.sql) | Membuat state baca/selesai notifikasi per user untuk fitur Tindak Lanjut. |
| [maintenance/add-isp-document-columns.sql](maintenance/add-isp-document-columns.sql) | Menambahkan kolom metadata file BAK & kontrak ISP yang dipakai frontend. |
| [maintenance/add-isp-contract-row-status.sql](maintenance/add-isp-contract-row-status.sql) | Menambahkan kolom `status` kompatibilitas pada `isp_contract_rows` agar payload frontend lama tetap bisa ditulis. |
| [maintenance/add-isp-entry-points.sql](maintenance/add-isp-entry-points.sql) | Menambahkan titik entry FO ISP dan pilihan redundansi customer opsional (aman rerun). |
| [maintenance/add-route-point-coordinates.sql](maintenance/add-route-point-coordinates.sql) | Menambahkan kolom koordinat terstruktur (`latitude`/`longitude`) pada titik jalur dan geometri/metadata rute pada versi jalur + backfill dari `note` (Fase 1 migrasi FO planner). |
| [maintenance/add-customer-logo-url.sql](maintenance/add-customer-logo-url.sql) | Menambahkan kolom `logo_url` (opsional) pada `customers`. |
| [maintenance/add-contract-version-contract-number.sql](maintenance/add-contract-version-contract-number.sql) | Menambahkan kolom `contract_number` pada `contract_versions`. |

### Index & optimasi performa

| Script | Fungsi |
| --- | --- |
| [maintenance/add-performance-indexes.sql](maintenance/add-performance-indexes.sql) | Index read-path Supabase/PostgREST untuk dashboard, pelanggan, ISP, invoice, kontrak, dokumen, route, dan follow-up (aman rerun, `IF NOT EXISTS`). |
| [maintenance/optimize-monitoring-notification-queries.sql](maintenance/optimize-monitoring-notification-queries.sql) | Optimasi jalur query monitoring + notifikasi (aman rerun). |

### Koreksi & schema-clarification data

| Script | Fungsi |
| --- | --- |
| [maintenance/clarify-customer-contract-schema.sql](maintenance/clarify-customer-contract-schema.sql) | Comment, constraint `NOT VALID`, dan audit query untuk schema kontrak customer. |
| [maintenance/fix-customer-contract-package-data.sql](maintenance/fix-customer-contract-package-data.sql) | Koreksi data paket kontrak (BTN/Wastec/Charoen) dan normalisasi sharing core. |
| [maintenance/fix-lado-indosat-fni-import-adjustments.sql](maintenance/fix-lado-indosat-fni-import-adjustments.sql) | Penyesuaian hasil import data Lado/Indosat/FNI (bertanggal). |
| [maintenance/fix-merapi-separate-customers.sql](maintenance/fix-merapi-separate-customers.sql) | Memisahkan PT Merapi Utama Pharma menjadi 2 customer terpisah (bertanggal). |
| [maintenance/fix-merapi-duplicate-customer.sql](maintenance/fix-merapi-duplicate-customer.sql) | Memisahkan PT Merapi untuk PT Medialink Global Mandiri / koreksi duplikat (bertanggal). |
| [maintenance/fix-merapi-move-contracts.sql](maintenance/fix-merapi-move-contracts.sql) | Memindahkan kontrak PT Merapi ke customer yang benar (bertanggal). |
| [maintenance/fix-wastec-active-contract-number.sql](maintenance/fix-wastec-active-contract-number.sql) | Memperbaiki nomor kontrak aktif customer Wastec. |
| [maintenance/backfill-btn-monthly-invoices.sql](maintenance/backfill-btn-monthly-invoices.sql) | Backfill invoice bulanan untuk customer BTN. |

## `seed/` — Seed, Upsert & Rollback Data Production

Semua script `insert-*-production.sql` bersifat **upsert idempotent** dari data spreadsheet per ISP/vendor.

### Contoh dataset Cendikia (lengkap + rollback)

| Script | Fungsi |
| --- | --- |
| [seed/seed-cendikia-supabase-full.sql](seed/seed-cendikia-supabase-full.sql) | Seed penuh PT Cendikia Global Solusi (ISP/vendor) + tenant BTN & Wastec. |
| [seed/rollback-cendikia-supabase.sql](seed/rollback-cendikia-supabase.sql) | Rollback data seed Cendikia (bentuk lama maupun yang sudah dikoreksi). |

### Upsert customer per ISP/vendor (aktif)

| Script | ISP/Vendor |
| --- | --- |
| [seed/insert-cendikia-additional-customers-production.sql](seed/insert-cendikia-additional-customers-production.sql) | PT Cendikia Global Solusi (customer tambahan) |
| [seed/insert-charoen-pokphand-production.sql](seed/insert-charoen-pokphand-production.sql) | PT Charoen Pokphand Indonesia |
| [seed/insert-citra-prima-media-production.sql](seed/insert-citra-prima-media-production.sql) | PT Citra Prima Media |
| [seed/insert-icon-plus-customers-production.sql](seed/insert-icon-plus-customers-production.sql) | PT Indonesia Comnets Plus (ICON+) |
| [seed/insert-iforte-telkom-moratel-jenius-production.sql](seed/insert-iforte-telkom-moratel-jenius-production.sql) | iForte, Telkom, Moratel, Jenius |
| [seed/insert-lado-indosat-fni-production.sql](seed/insert-lado-indosat-fni-production.sql) | PT Lado Tekno Parkir, Indosat, FNI |
| [seed/insert-medialink-customers-production.sql](seed/insert-medialink-customers-production.sql) | PT Medialink Global Mandiri |
| [seed/insert-multitech-panca-production.sql](seed/insert-multitech-panca-production.sql) | Multitech & Panca Karsa |
| [seed/insert-xl-axiata-production.sql](seed/insert-xl-axiata-production.sql) | PT XL Axiata Tbk |
| [seed/insert-xl-smart-telecom-production.sql](seed/insert-xl-smart-telecom-production.sql) | PT XLSMART Telecom Sejahtera Tbk / XL Axiata |

### Upsert customer berhenti / batch stopped

| Script | ISP/Vendor |
| --- | --- |
| [seed/insert-aplikanusa-customers-production.sql](seed/insert-aplikanusa-customers-production.sql) | PT Aplikanusa Lintasarta (aktif) |
| [seed/insert-aplikanusa-stopped-batch-production.sql](seed/insert-aplikanusa-stopped-batch-production.sql) | PT Aplikanusa Lintasarta (berhenti) |
| [seed/insert-cendikia-stopped-batch-production.sql](seed/insert-cendikia-stopped-batch-production.sql) | PT Cendikia Global Solusi (berhenti) |
| [seed/insert-cendikia-enseval-stopped-production.sql](seed/insert-cendikia-enseval-stopped-production.sql) | PT Cendikia Global Solusi — Enseval (berhenti) |
| [seed/insert-icon-plus-stopped-batch-production.sql](seed/insert-icon-plus-stopped-batch-production.sql) | PT Indonesia Comnets Plus (ICON+) (berhenti) |
| [seed/insert-inet-global-production.sql](seed/insert-inet-global-production.sql) | PT Inet Global (berhenti) |
| [seed/insert-medialink-stopped-batch-production.sql](seed/insert-medialink-stopped-batch-production.sql) | PT Medialink Global Mandiri (berhenti) |

## `dev/` — Development Lokal

| Script | Fungsi |
| --- | --- |
| [dev/dev-frontend.sh](dev/dev-frontend.sh) | Menjalankan frontend development (auto-install dependency bila belum ada). |

---

> **Catatan:** Sebagian script `fix-*`, `insert-*`, dan `*-production.sql` bersifat **bertanggal/sekali pakai** (snapshot koreksi data pada waktu tertentu). Gunakan PRD/README sebagai acuan kondisi terkini, bukan isi script historis ini.
