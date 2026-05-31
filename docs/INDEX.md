# Peta Dokumentasi Sistem FO KIMA

Halaman ini adalah **satu-satunya titik masuk** untuk seluruh dokumentasi. Jika bingung harus mulai dari mana, mulai di sini.

Dokumen dikelompokkan ke dalam tiga tingkat agar jelas mana yang masih berlaku dan mana yang hanya catatan historis:

| Tingkat | Arti | Boleh dijadikan acuan kondisi terkini? |
| --- | --- | --- |
| 📌 **Kanonik** | Sumber kebenaran yang selalu dijaga tetap mutakhir | Ya |
| 📖 **Panduan & Referensi** | Cara melakukan sesuatu (setup, deploy, operasi) | Ya, untuk prosedur |
| 🗄️ **Historis / Bertanggal** | Snapshot per tanggal (laporan, changelog, status, analisis lama) | **Tidak** — hanya konteks/riwayat |

> **Aturan singkat:** kalau sebuah dokumen punya **tanggal di nama file** (mis. `2026-05-18-...`) atau berada di `reports/`, `changelog/`, `implementation-status/`, atau `analysis/`, anggap itu **historis** — menggambarkan keadaan pada saat ditulis, bukan kondisi sistem sekarang.

---

## 🚦 Mulai Dari Sini (jalur baca per peran)

**Saya developer baru:**
1. [../README.md](../README.md) — overview & quick start
2. [../DEV_GUIDE.md](../DEV_GUIDE.md) — setup development lokal
3. [../prd/PRD-sistem-arsip-kima.md](../prd/PRD-sistem-arsip-kima.md) — apa yang dibangun & aturan bisnis
4. [../CLAUDE.md](../CLAUDE.md) — konvensi akses Supabase & aturan implementasi
5. [../scripts/README.md](../scripts/README.md) — script operasional

**Saya operator / admin data:**
1. [guides/supabase-setup-guide.md](guides/supabase-setup-guide.md) — setup Auth & RLS
2. [operations/panduan-insert-production.md](operations/panduan-insert-production.md) — cara insert data production
3. [operations/TESTING_CHECKLIST.md](operations/TESTING_CHECKLIST.md) — verifikasi sebelum rilis
4. [deployment/DEPLOYMENT_GUIDE.md](deployment/DEPLOYMENT_GUIDE.md) — langkah deploy

**Saya ingin memahami produk / proses bisnis:**
1. [../prd/PRD-sistem-arsip-kima.md](../prd/PRD-sistem-arsip-kima.md) — PRD lengkap
2. [../prd/business-flow.png](../prd/business-flow.png) — diagram alur bisnis
3. [../prd/sequence-diagram-komprehensif.md](../prd/sequence-diagram-komprehensif.md) — sequence diagram

**Saya AI agent / asisten coding:**
1. [../CLAUDE.md](../CLAUDE.md) → 2. [../prd/PRD-sistem-arsip-kima.md](../prd/PRD-sistem-arsip-kima.md) → 3. [../DEV_GUIDE.md](../DEV_GUIDE.md)

---

## 📌 Kanonik (sumber kebenaran)

| Dokumen | Deskripsi |
| --- | --- |
| [../README.md](../README.md) | Overview project, arsitektur, dan quick start. |
| [../prd/PRD-sistem-arsip-kima.md](../prd/PRD-sistem-arsip-kima.md) | Product Requirements Document — flow bisnis, model data, dan aturan schema. |
| [../DEV_GUIDE.md](../DEV_GUIDE.md) | Panduan development lokal (Supabase-only). |
| [../CLAUDE.md](../CLAUDE.md) | Aturan akses Supabase & konvensi implementasi untuk kontributor/agent. |

---

## 📖 Panduan & Referensi

### Setup & Operasi Harian

| Dokumen | Deskripsi |
| --- | --- |
| [guides/QUICK_REFERENCE.md](guides/QUICK_REFERENCE.md) | Referensi command dan alur harian. |
| [guides/supabase-setup-guide.md](guides/supabase-setup-guide.md) | Setup Supabase Auth dan RLS. |
| [operations/panduan-insert-production.md](operations/panduan-insert-production.md) | Panduan insert data production. |
| [operations/TESTING_CHECKLIST.md](operations/TESTING_CHECKLIST.md) | Checklist pengujian manual. |
| [operations/BUG_TRACKING.md](operations/BUG_TRACKING.md) | Catatan bug dan tracking. |
| [operations/kredensial-admin.md](operations/kredensial-admin.md) | Catatan kredensial admin untuk operasional. |

### Deployment

| Dokumen | Deskripsi |
| --- | --- |
| [deployment/DEPLOYMENT_GUIDE.md](deployment/DEPLOYMENT_GUIDE.md) | Checklist dan langkah deployment. |
| [deployment/status-koneksi-supabase.md](deployment/status-koneksi-supabase.md) | Status koneksi Supabase dan catatan environment. |

### Arsitektur, Diagram & Schema

| Dokumen | Deskripsi |
| --- | --- |
| [../prd/sequence-diagram-komprehensif.md](../prd/sequence-diagram-komprehensif.md) | Sequence diagram sistem. |
| [../prd/business-flow.png](../prd/business-flow.png) | Diagram business flow. |
| [database/document-schema.sql](database/document-schema.sql) | Referensi schema dokumen (pendukung). |

### README Komponen

| Dokumen | Deskripsi |
| --- | --- |
| [../scripts/README.md](../scripts/README.md) | Indeks script operasional Supabase/SQL/dev. |
| [../frontend/README.md](../frontend/README.md) | Catatan khusus aplikasi frontend. |
| [../infra/valhalla/README.md](../infra/valhalla/README.md) | Konfigurasi layanan Valhalla (route planner). |

---

## 🗄️ Historis / Bertanggal (konteks & riwayat — bukan kondisi terkini)

Dokumen di bawah ini menggambarkan keadaan pada saat ditulis. **Jangan** dijadikan acuan kondisi sistem sekarang; gunakan PRD/README untuk itu. **Jangan** diedit untuk "memperbarui" — buat catatan baru bila perlu.

### Changelog

| Dokumen | Deskripsi |
| --- | --- |
| [changelog/2026-05-18-dashboard-remove-financial-cards.md](changelog/2026-05-18-dashboard-remove-financial-cards.md) | Perubahan dashboard: hapus kartu finansial. |
| [changelog/2026-05-18-monitoring-pagination.md](changelog/2026-05-18-monitoring-pagination.md) | Penambahan pagination pada monitoring. |

### Status Implementasi

| Dokumen | Deskripsi |
| --- | --- |
| [implementation-status/2026-05-18-soft-delete-implementation.md](implementation-status/2026-05-18-soft-delete-implementation.md) | Status implementasi soft delete & Tempat Sampah (fitur sudah rilis). |

### Laporan (Reports)

| Dokumen | Deskripsi |
| --- | --- |
| [reports/contract-renewal/RINGKASAN_LENGKAP.md](reports/contract-renewal/RINGKASAN_LENGKAP.md) | Ringkasan lengkap fitur perpanjangan kontrak. |
| [reports/contract-renewal/ANALISIS_PERPANJANGAN_KONTRAK.md](reports/contract-renewal/ANALISIS_PERPANJANGAN_KONTRAK.md) | Analisis perpanjangan kontrak. |
| [reports/contract-renewal/IMPLEMENTASI_PERINGATAN_INVOICE.md](reports/contract-renewal/IMPLEMENTASI_PERINGATAN_INVOICE.md) | Implementasi peringatan invoice. |
| [reports/contract-renewal/LAPORAN_TESTING_PERPANJANGAN_KONTRAK.md](reports/contract-renewal/LAPORAN_TESTING_PERPANJANGAN_KONTRAK.md) | Laporan testing perpanjangan kontrak. |
| [reports/contract-renewal/TEST_REPORT_CONTRACT_CHANGE.md](reports/contract-renewal/TEST_REPORT_CONTRACT_CHANGE.md) | Laporan test perubahan kontrak. |

### Analisis & Catatan Desain (pendukung/lama)

| Dokumen | Deskripsi |
| --- | --- |
| [analysis/document-archiving-tenant-monitoring-system-design.md](analysis/document-archiving-tenant-monitoring-system-design.md) | Desain awal sistem (rationale bisnis masih relevan; bagian backend NestJS sudah usang). |
| [refactor-supabase-direct-access.md](refactor-supabase-direct-access.md) | Catatan refactor ke Supabase direct access (menjelaskan asal arsitektur sekarang). |

---

## 📂 Ke Mana Dokumen Baru Harus Diletakkan?

Agar dokumentasi tidak kembali berantakan, ikuti panduan ini saat membuat dokumen baru:

| Jenis dokumen | Lokasi | Konvensi nama |
| --- | --- | --- |
| Sumber kebenaran produk/teknis | update file **kanonik** yang sudah ada (PRD/README/DEV_GUIDE) | — |
| Panduan cara melakukan sesuatu | `docs/guides/`, `docs/deployment/`, atau `docs/operations/` | nama deskriptif |
| Catatan perubahan rilis | `docs/changelog/` | `YYYY-MM-DD-deskripsi.md` |
| Status implementasi fitur | `docs/implementation-status/` | `YYYY-MM-DD-deskripsi.md` |
| Laporan/analisis sekali pakai | `docs/reports/<topik>/` atau `docs/analysis/` | nama deskriptif |

Prinsip: **utamakan memperbarui dokumen kanonik** daripada membuat file baru. Buat file historis bertanggal hanya untuk merekam kejadian/keputusan pada satu titik waktu — dan setelah ditulis, biarkan sebagai arsip.

---

## Ringkasan Arsitektur

- **Frontend:** React + Vite.
- **Backend utama:** Supabase direct access dari frontend (tanpa NestJS).
- **Database/Auth/API:** Supabase Cloud (PostgreSQL + Auth + REST/RPC + Storage).
- **Keamanan akses data:** Supabase Row Level Security.
- **Route planner:** Valhalla (opsional, untuk fitur peta/jalur FO).

Detail lengkap ada di [../prd/PRD-sistem-arsip-kima.md](../prd/PRD-sistem-arsip-kima.md) bagian Arsitektur Teknis.
