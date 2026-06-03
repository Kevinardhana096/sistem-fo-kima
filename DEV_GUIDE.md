# Development Guide — Sistem FO KIMA

Panduan development lokal untuk Sistem FO KIMA.

> **Arsitektur saat ini:** aplikasi adalah frontend **React + Vite** yang mengakses **Supabase** secara langsung (Auth, Database/REST/RPC, Storage). **Tidak ada** service backend NestJS dan **tidak ada** Prisma untuk alur utama aplikasi. Valhalla hanya layanan pendukung opsional untuk fitur route planner FO.

---

## Prasyarat

- **Node.js 20+** (direkomendasikan Node 22) dan **npm**.
- Akses ke **Supabase project** (URL + anon key) untuk lingkungan yang dituju.
- Editor SQL Supabase (Supabase Dashboard → SQL Editor) untuk menjalankan script operasional bila diperlukan.

Semua perintah di bawah dijalankan dari **root repository** kecuali disebutkan lain.

---

## Quick Start

```bash
# 1. Install dependencies frontend
npm --prefix frontend install

# 2. Siapkan environment (lihat bagian Environment di bawah)
#    frontend/.env.development

# 3. Jalankan development server
npm --prefix frontend run dev
```

Aplikasi development berjalan di:

```text
http://localhost:5173
```

Alternatif, gunakan script helper yang otomatis meng-install dependency bila belum ada:

```bash
./scripts/dev/dev-frontend.sh
```

---

## Environment

Frontend membaca environment Vite dari `frontend/.env.development` (untuk `npm run dev`) atau `frontend/.env.production` (untuk build production). File ini **berisi kredensial dan tidak boleh di-commit** — perlakukan sebagai rahasia.

> Gunakan `frontend/.env.example` sebagai template: salin ke `frontend/.env.development` (untuk `npm run dev`) atau `frontend/.env.production` (untuk build), lalu isi nilainya. Gunakan Supabase project **terpisah** untuk development dan production. **Jangan** membagikan nilai key di chat, commit, atau log.

```bash
cp frontend/.env.example frontend/.env.development
```

Variabel yang digunakan aplikasi:

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Ya | URL Supabase project. |
| `VITE_SUPABASE_ANON_KEY` | Ya | Supabase anon/public key. |
| `VITE_SUPABASE_STORAGE_BUCKET` | Opsional | Nama bucket Supabase Storage untuk dokumen (bila berbeda dari default). |
| `VITE_VALHALLA_HOST` | Opsional | Host layanan Valhalla untuk fitur route planner FO. |
| `VITE_ADMIN_WHATSAPP_NUMBER` | Opsional | Nomor WhatsApp admin untuk fitur notifikasi/kontak. |
| `VITE_API_BASE_URL` | Opsional | Base URL API tambahan (dipakai pada konfigurasi production tertentu). |
| `VITE_DEV_ADMIN_EMAIL` / `VITE_DEV_ADMIN_PASSWORD` | Opsional (dev) | Kredensial tombol "Quick login" Admin — hanya muncul di build development. |
| `VITE_DEV_TEKNISI_EMAIL` / `VITE_DEV_TEKNISI_PASSWORD` | Opsional (dev) | Kredensial Quick login Teknisi (development saja). |
| `VITE_DEV_ISP_EMAIL` / `VITE_DEV_ISP_PASSWORD` | Opsional (dev) | Kredensial Quick login ISP (development saja). |

> Variabel `VITE_DEV_*` hanya untuk **development lokal**, harus diarahkan ke akun pada Supabase project DEV (bukan production), dan tidak boleh diset di environment production.

Contoh kerangka `frontend/.env.development` (isi nilai sendiri):

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VALHALLA_HOST=
```

---

## Perintah npm

Semua script didefinisikan di `frontend/package.json` dan dijalankan dengan prefix `--prefix frontend`:

| Perintah | Fungsi |
| --- | --- |
| `npm --prefix frontend run dev` | Menjalankan Vite dev server di `http://localhost:5173`. |
| `npm --prefix frontend run build` | Build production ke `frontend/dist`. |
| `npm --prefix frontend run preview` | Preview hasil build production secara lokal. |
| `npm --prefix frontend run lint` | Menjalankan ESLint pada seluruh frontend. |
| `npm --prefix frontend run test` | Menjalankan unit test sekali jalan (Vitest). |
| `npm --prefix frontend run test:watch` | Menjalankan Vitest dalam mode watch. |

---

## Setup Supabase (Auth, RLS, Data)

Konfigurasi database dan akses dilakukan melalui **Supabase SQL Editor**, bukan migration backend. Jalankan script secara manual setelah direview.

Langkah umum untuk environment baru:

1. **Auth user** — buat user via `scripts/auth/create-supabase-auth-users.sql`; untuk akun ISP gunakan `scripts/auth/create-isp-auth-accounts-from-isps.sql` dan `scripts/auth/map-isp-users.sql`.
2. **Row Level Security** — aktifkan dan atur policy via `scripts/rls/setup-supabase-rls-policies.sql`.
3. **Index performa (opsional namun disarankan)** — `scripts/maintenance/add-performance-indexes.sql`.
4. **Seed data demo (opsional)** — `scripts/seed/seed-cendikia-supabase-full.sql` (rollback: `scripts/seed/rollback-cendikia-supabase.sql`).

Indeks lengkap script ada di [scripts/README.md](scripts/README.md).

> Script production harus **idempotent** dan **direview** sebelum dijalankan di Supabase SQL Editor. Jangan menjalankan script seed/maintenance ke database production tanpa memahami dampaknya. Panduan setup detail: [docs/guides/supabase-setup-guide.md](docs/guides/supabase-setup-guide.md).

---

## Verifikasi Sebelum Commit / Deploy

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test
```

Untuk perubahan UI/flow, jalankan aplikasi (`npm --prefix frontend run dev`) dan verifikasi langsung di browser. Lihat juga [docs/operations/TESTING_CHECKLIST.md](docs/operations/TESTING_CHECKLIST.md) dan [docs/deployment/DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md).

---

## Troubleshooting

### Port 5173 sudah dipakai

```bash
lsof -ti:5173 | xargs kill -9
```

Atau jalankan Vite di port lain: `npm --prefix frontend run dev -- --port 5174`.

### Valhalla lokal tidak jalan

Jika fitur route planner dipakai secara lokal, jalankan Valhalla dari root repo:

```bash
docker compose up -d valhalla-upstream valhalla-proxy
```

Lalu set `VITE_VALHALLA_HOST=http://localhost:8002` di `frontend/.env.development`.

Jika `docker compose` gagal karena image belum terunduh atau data `sulawesi.osm.pbf` tidak lengkap, periksa `infra/valhalla/data/` dan `infra/valhalla/runtime/`.

### Environment tidak terbaca

- Pastikan file bernama `frontend/.env.development` (bukan `.env` di root).
- Pastikan setiap variabel diawali prefix `VITE_` agar diekspos oleh Vite.
- Restart dev server setelah mengubah file `.env`.

### Error koneksi Supabase (401/403/empty data)

- Cek `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` benar untuk project yang dituju.
- Pastikan RLS policy sudah di-setup (`scripts/rls/setup-supabase-rls-policies.sql`) dan user login memiliki role yang sesuai.
- Untuk masalah koneksi Supabase, verifikasi `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, dan policy RLS yang aktif.

### Clean install dependencies

```bash
rm -rf frontend/node_modules frontend/package-lock.json
npm --prefix frontend install
```

---

## Referensi

- [README.md](README.md) — overview project dan arsitektur.
- [CLAUDE.md](CLAUDE.md) — aturan akses Supabase dan konvensi implementasi.
- [docs/INDEX.md](docs/INDEX.md) — indeks dokumentasi lengkap.
- [prd/PRD-sistem-arsip-kima.md](prd/PRD-sistem-arsip-kima.md) — Product Requirements Document.
- [scripts/README.md](scripts/README.md) — indeks script operasional Supabase/SQL/dev.
