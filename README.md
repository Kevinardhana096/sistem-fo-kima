# Sistem FO KIMA

Sistem arsip dokumen dan monitoring tenant berbasis web untuk pengelolaan ISP, pelanggan, kontrak, invoice, dan jalur fiber optik KIMA.

## Struktur Project

```text
sistem-fo-kima/
├── frontend/              # React + Vite application
├── docs/                  # Dokumentasi teknis, operasional, deployment, analisis
│   ├── guides/            # Panduan penggunaan dan setup
│   ├── deployment/        # Deployment dan status koneksi
│   ├── operations/        # Checklist, bug tracking, panduan operasional
│   ├── analysis/          # Analisis dan catatan desain lama/pendukung
│   └── database/          # Referensi schema/dokumen database
├── prd/                   # Product requirements dan diagram bisnis
├── scripts/               # Script operasional Supabase/SQL/dev
│   ├── auth/              # Script user/auth
│   ├── rls/               # Script Row Level Security
│   ├── seed/              # Script seed/rollback data
│   ├── maintenance/       # Script maintenance/audit data
│   └── dev/               # Script development lokal
└── infra/                 # Infrastruktur pendukung seperti Valhalla
```

## Quick Start

Arsitektur utama saat ini menggunakan frontend React/Vite yang mengakses Supabase secara langsung.

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Aplikasi development berjalan di:

```text
http://localhost:5173
```

## Environment

Frontend membutuhkan environment Supabase di `frontend/.env.development` atau `frontend/.env.production`.

Variabel yang umum digunakan:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_VALHALLA_HOST` untuk route planner FO jika digunakan

## Dokumentasi

- [docs/INDEX.md](docs/INDEX.md) — indeks dokumentasi utama.
- [DEV_GUIDE.md](DEV_GUIDE.md) — panduan development.
- [prd/PRD-sistem-arsip-kima.md](prd/PRD-sistem-arsip-kima.md) — Product Requirements Document.
- [prd/sequence-diagram-komprehensif.md](prd/sequence-diagram-komprehensif.md) — sequence diagram sistem.

## Arsitektur Saat Ini

```text
Frontend React/Vite
        |
        v
Supabase Auth + Supabase Database/REST + Supabase Storage
        |
        v
PostgreSQL + Row Level Security
```

Komponen:

- **Frontend:** React + Vite.
- **Backend utama:** Supabase direct access dari frontend.
- **Database/Auth:** Supabase PostgreSQL dan Supabase Auth.
- **Security:** Supabase Row Level Security.
- **Route planner:** Valhalla sebagai layanan pendukung jika fitur peta digunakan.

Tidak ada service NestJS yang perlu dijalankan untuk alur utama aplikasi saat ini.

## Scripts Penting

- [scripts/README.md](scripts/README.md) — indeks script operasional.
- [scripts/dev/dev-frontend.sh](scripts/dev/dev-frontend.sh) — menjalankan frontend development.
- [scripts/auth/create-supabase-auth-users.sql](scripts/auth/create-supabase-auth-users.sql) — membuat user Supabase Auth.
- [scripts/rls/setup-supabase-rls-policies.sql](scripts/rls/setup-supabase-rls-policies.sql) — setup Row Level Security.
- [scripts/maintenance/fix-customer-contract-package-data.sql](scripts/maintenance/fix-customer-contract-package-data.sql) — koreksi data paket kontrak customer.
- [scripts/maintenance/clarify-customer-contract-schema.sql](scripts/maintenance/clarify-customer-contract-schema.sql) — comment, constraint, dan audit schema kontrak customer.

Script production dijalankan manual melalui Supabase SQL Editor setelah direview.

## Verifikasi

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
```

## Valhalla Route Planner

Konfigurasi Valhalla berada di `infra/valhalla/`. Layanan ini hanya diperlukan untuk fitur route planner FO.

## Status

**Last Updated:** 2026-05-31  
**Version:** 1.4  
**Status:** Active Development
