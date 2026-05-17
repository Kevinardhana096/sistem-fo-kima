# Scripts Sistem FO KIMA

Folder ini berisi script operasional untuk Supabase, seed data, maintenance data, RLS, dan development lokal.

> Script production harus direview dan dijalankan manual melalui Supabase SQL Editor. Jangan jalankan script maintenance/seed ke database production tanpa memahami dampaknya.

## Auth

| Script | Fungsi |
| --- | --- |
| [auth/create-supabase-auth-users.sql](auth/create-supabase-auth-users.sql) | Membuat user Supabase Auth. |
| [auth/insert-admin-user-production.sql](auth/insert-admin-user-production.sql) | Insert user admin untuk kebutuhan operasional/legacy. |

## Row Level Security

| Script | Fungsi |
| --- | --- |
| [rls/setup-supabase-rls-policies.sql](rls/setup-supabase-rls-policies.sql) | Mengaktifkan dan mengatur Supabase Row Level Security policies. |

## Seed dan Rollback Data

| Script | Fungsi |
| --- | --- |
| [seed/seed-cendikia-supabase-full.sql](seed/seed-cendikia-supabase-full.sql) | Seed data Cendikia/customer lengkap. |
| [seed/rollback-cendikia-supabase.sql](seed/rollback-cendikia-supabase.sql) | Rollback data seed Cendikia/customer. |
| [seed/insert-charoen-pokphand-production.sql](seed/insert-charoen-pokphand-production.sql) | Insert data PT Charoen Pokphand. |
| [seed/insert-cendikia-additional-customers-production.sql](seed/insert-cendikia-additional-customers-production.sql) | Insert batch customer tambahan PT Cendikia Global Solusi dari spreadsheet. |
| [seed/insert-icon-plus-customers-production.sql](seed/insert-icon-plus-customers-production.sql) | Insert batch customer PT Indonesia Comnets Plus (ICON+) dari spreadsheet. |

## Maintenance dan Audit Data

| Script | Fungsi |
| --- | --- |
| [maintenance/fix-customer-contract-package-data.sql](maintenance/fix-customer-contract-package-data.sql) | Koreksi data paket kontrak customer BTN/Wastec/Charoen dan normalisasi sharing core. |
| [maintenance/clarify-customer-contract-schema.sql](maintenance/clarify-customer-contract-schema.sql) | Menambahkan comment, constraint `NOT VALID`, dan audit query untuk schema kontrak customer. |

## Development

| Script | Fungsi |
| --- | --- |
| [dev/dev-frontend.sh](dev/dev-frontend.sh) | Menjalankan frontend development. |
