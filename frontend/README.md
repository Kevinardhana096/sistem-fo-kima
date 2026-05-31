# Frontend - Sistem FO KIMA

Aplikasi web (React + Vite) untuk arsip dokumen dan monitoring tenant KIMA. Frontend mengakses Supabase secara langsung (Auth, Database/REST/RPC, Storage); tidak ada backend terpisah.

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:5173
```

Konfigurasi environment ada di `.env.development` / `.env.production`. Salin dari [`.env.example`](.env.example) dan isi nilainya (jangan commit file `.env` berisi rahasia).

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Build production ke `dist/` |
| `npm run preview` | Preview hasil build |
| `npm run lint` | ESLint |
| `npm run test` | Unit test (Vitest) sekali jalan |
| `npm run test:watch` | Vitest mode watch |

## Struktur

```text
src/
├── app/          # utilities & shared app logic (termasuk session)
├── components/   # komponen UI bersama (layout, shared, ErrorBoundary)
├── features/     # halaman per fitur: dashboard, monitoring, pelanggan, login, dll.
├── lib/          # akses Supabase & API mapper (api.js, supabase.js, files.js)
└── roles/        # konfigurasi route/menu per role (admin, teknisi, isp)
```

## Dokumentasi

Lihat dokumentasi project di root repo:

- [`../DEV_GUIDE.md`](../DEV_GUIDE.md) - panduan development
- [`../docs/INDEX.md`](../docs/INDEX.md) - peta dokumentasi lengkap
- [`../prd/PRD-sistem-arsip-kima.md`](../prd/PRD-sistem-arsip-kima.md) - Product Requirements Document
