# Deployment Guide — Sistem FO KIMA

Panduan deploy production untuk Sistem FO KIMA: frontend **React + Vite** yang mengakses **Supabase** secara langsung (Auth, Database/REST/RPC, Storage). Tidak ada service backend NestJS yang perlu dideploy.

> Dokumen ini adalah **panduan prosedur** (lihat `docs/INDEX.md`). Jaga tetap mutakhir; jangan mencantumkan kredensial/nilai key asli di sini.

---

## 1. Arsitektur Deploy

```text
Vercel (static build frontend/dist)
        |
        v
Supabase Cloud (Auth + PostgreSQL + RLS + Storage + REST/RPC)
        |
        v
Valhalla (opsional, hanya untuk route planner FO)
```

- **Host frontend:** Vercel (static hosting + SPA rewrite). Konfigurasi build ada di `vercel.json` di root repo.
- **Backend/data:** Supabase Cloud. Tidak ada server aplikasi terpisah.
- **Script SQL production:** dijalankan **manual** via Supabase SQL Editor setelah direview.

`vercel.json` saat ini:

```json
{
  "installCommand": "cd frontend && npm ci",
  "buildCommand": "cd frontend && npm run build",
  "outputDirectory": "frontend/dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Rewrite ke `/index.html` diperlukan agar routing SPA berfungsi pada refresh halaman dalam.

---

## 2. Pra-Deploy Checklist

### 2.1 Database / Supabase
- [ ] Project Supabase **production** sudah disiapkan (terpisah dari project development).
- [ ] User Supabase Auth + role sudah dibuat (`scripts/auth/`).
- [ ] RLS aktif dan policy ter-setup (`scripts/rls/setup-supabase-rls-policies.sql`).
- [ ] Index performa dijalankan bila perlu (`scripts/maintenance/add-performance-indexes.sql`).
- [ ] Akun ISP ter-provision (`scripts/auth/create-isp-auth-accounts-from-isps.sql`) dan mapping `public.isp_user_accounts` terisi.

Detail langkah Supabase: [../guides/supabase-setup-guide.md](../guides/supabase-setup-guide.md).

### 2.2 Kode & Build
- [ ] `npm --prefix frontend run lint` lulus.
- [ ] `npm --prefix frontend run test` lulus.
- [ ] `npm --prefix frontend run build` sukses tanpa error.
- [ ] Pengujian manual sesuai [../operations/TESTING_CHECKLIST.md](../operations/TESTING_CHECKLIST.md).

### 2.3 Environment Variables (di Vercel Project Settings)
Set environment variables berikut pada scope **Production** (dan **Preview** bila dipakai). **Jangan** commit nilainya ke repo.

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Ya | URL Supabase project production. |
| `VITE_SUPABASE_ANON_KEY` | Ya | Supabase anon/public key project production. |
| `VITE_SUPABASE_STORAGE_BUCKET` | Opsional | Nama bucket Storage dokumen (bila berbeda dari default). |
| `VITE_VALHALLA_HOST` | Opsional | Host Valhalla untuk route planner FO. |
| `VITE_ADMIN_WHATSAPP_NUMBER` | Opsional | Nomor WhatsApp admin untuk tautan bantuan akses di halaman login. |
| `VITE_API_BASE_URL` | Opsional | Base URL API tambahan bila dipakai. |

> Variabel `VITE_DEV_*` (quick login) **hanya** untuk development lokal dan tidak boleh diset di production. Lihat `frontend/.env.example`.

---

## 3. Langkah Deploy (Vercel)

### Opsi A — Git Integration (direkomendasikan)
1. Hubungkan repo ke Vercel (import project). Vercel membaca `vercel.json` otomatis.
2. Set environment variables (lihat §2.3) di **Project Settings → Environment Variables**.
3. Push ke branch yang ditarget. Buka Pull Request ke `main`.
4. Vercel membuat **Preview Deployment** per PR untuk verifikasi.
5. Setelah PR di-merge ke `main`, Vercel menjalankan **Production Deployment** otomatis.
6. Tunggu status **Ready**, lalu lakukan smoke test (§4).

### Opsi B — Vercel CLI (manual)
```bash
# dari root repo
npx vercel            # deploy preview
npx vercel --prod     # deploy production
```

> Build dijalankan oleh Vercel sesuai `vercel.json` (`cd frontend && npm ci` lalu `npm run build`, output `frontend/dist`). Tidak perlu commit folder `dist`.

---

## 4. Smoke Test Setelah Deploy

1. Buka production URL.
2. Login untuk tiap role (Admin, Teknisi, ISP) dengan akun yang ada di Supabase production. **Kredensial diambil dari password manager / kanal operasional aman — bukan dari dokumen ini.**
3. Verifikasi fitur inti:
   - Dashboard tampil.
   - Workspace Pelanggan: list + detail + pagination "Muat Lagi".
   - Manajemen ISP: list + detail.
   - Monitoring billing: spreadsheet per tahun/ISP.
   - Tindak Lanjut & Log Aktivitas terisi.
   - Tempat Sampah: lihat/pulihkan/hapus permanen.
   - Route planner FO (jika Valhalla aktif).
4. Cek console browser & tab network: tidak ada error 401/403/5xx yang tidak terduga.
5. Supabase Dashboard → Logs: pantau error Auth/RLS/API.

---

## 5. Rollback

- **Via Vercel Dashboard:** buka tab **Deployments**, pilih deployment production sebelumnya yang sehat, lalu **Promote to Production** / **Rollback**.
- **Via Git:** buat commit revert pada `main` (mis. `git revert <sha>`), push, dan biarkan Vercel redeploy.
- **Perubahan data Supabase:** rollback data memakai script yang relevan (mis. `scripts/seed/rollback-*.sql`) dan harus direview sebelum dijalankan. Soft delete (Tempat Sampah) menyediakan restore untuk penghapusan entitas, bukan untuk rollback skema.

---

## 6. Pasca-Deploy

- Pantau Supabase Auth/API logs pada jam-jam pertama.
- Pantau RLS violations dan response time query monitoring.
- Catat bug pada [../operations/BUG_TRACKING.md](../operations/BUG_TRACKING.md).
- Jalankan/tinjau ulang `scripts/maintenance/add-performance-indexes.sql` jika query terasa lambat saat data membesar.

---

## 7. Referensi

- [../../DEV_GUIDE.md](../../DEV_GUIDE.md) — setup development & perintah npm.
- [../guides/supabase-setup-guide.md](../guides/supabase-setup-guide.md) — setup Auth & RLS.
- [../operations/TESTING_CHECKLIST.md](../operations/TESTING_CHECKLIST.md) — checklist pengujian manual.
- [deployment/status-koneksi-supabase.md](status-koneksi-supabase.md) — status koneksi Supabase.
- [../../prd/PRD-sistem-arsip-kima.md](../../prd/PRD-sistem-arsip-kima.md) — PRD (§10 Deployment & Operations).
