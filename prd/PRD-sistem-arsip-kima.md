# Product Requirements Document
# Sistem Arsip KIMA — Document Archiving & Tenant Monitoring System

**Versi:** 1.0  
**Tanggal:** 2026-05-10  
**Status:** Draft  

---

## 1. Latar Belakang

KIMA mengelola hubungan bisnis dengan dua jenis entitas utama: **ISP (Internet Service Provider)** sebagai mitra penyedia jaringan, dan **Tenant/Pelanggan** sebagai pengguna layanan. Operasional sehari-hari melibatkan pengelolaan kontrak, penagihan invoice, pemantauan status, dan pengarsipan dokumen yang selama ini dilakukan secara manual atau tersebar di berbagai tempat.

Sistem ini dibangun untuk menyatukan seluruh alur operasional tersebut dalam satu platform web internal yang terpusat, terstruktur, dan mudah digunakan oleh satu operator maupun tim kecil.

---

## 2. Tujuan Produk

- Menyediakan arsip dokumen terpusat yang terorganisir per pelanggan dan ISP.
- Mengotomasi pembaruan status kontrak dan pelanggan berdasarkan dokumen yang diunggah.
- Memberikan visibilitas penuh atas status billing, kontrak, dan kepatuhan dokumen.
- Mendukung perencanaan jalur fiber optik (FO) berbasis peta untuk teknisi lapangan.
- Menyederhanakan operasional harian dengan antarmuka yang minimal dan efisien.

---

## 3. Pengguna & Peran

| Peran | Deskripsi | Kapabilitas Utama |
|---|---|---|
| **Admin** | Super admin, pengelola penuh sistem | CRUD ISP, CRUD Tenant, akses semua fitur, kelola Tempat Sampah |
| **ISP** | Pengguna mitra ISP | Lihat data Tenant & ISP terkait, akses monitoring (read-only) |
| **Teknisi** | Staf operasional lapangan | Lihat data pelanggan, akses route planner FO, akses monitoring |

Autentikasi menggunakan username/password dengan session berbasis role. Setiap role memiliki menu dan rute yang diizinkan secara eksplisit.

---

## 4. Modul & Fitur

### 4.1 Dashboard
- Ringkasan status sistem: jumlah pelanggan aktif, ISP aktif, invoice belum bayar, kontrak akan expired.
- Notifikasi/alert operasional: kontrak mendekati jatuh tempo, invoice belum ditagih, dokumen wajib belum diunggah.

### 4.2 Manajemen ISP
- Daftar ISP dengan status: `aktif`, `nonaktif`, `expired`, `berhenti`.
- Detail ISP mencakup:
  - Informasi umum: nama, paket (`core` / `shared`), jumlah core, periode kontrak.
  - Logo ISP dan file kontrak.
  - Riwayat kontrak (contract rows) dengan status renewal per baris.
  - Alur renewal: upload surat penawaran → respons ISP (lanjut/tidak) → upload BAK → kontrak baru.
  - Follow-up renewal otomatis dan manual.
- Admin dapat membuat, mengedit, dan menghapus ISP.
- ISP/Teknisi hanya dapat melihat.

### 4.3 Manajemen Pelanggan (Tenant)
- Daftar pelanggan dengan status: `aktif`, `nonaktif`, `expired`, `berhenti`, `arsip`.
- Setiap pelanggan memiliki kode unik (`customer_code`) dan terhubung ke satu atau lebih ISP.
- Detail pelanggan terdiri dari tab:
  - **Overview**: informasi umum, status, biaya aktivasi.
  - **Kontrak**: daftar kontrak dan versi kontrak (perpanjangan), status, periode, alokasi core.
  - **Invoice**: daftar invoice per periode, status pembayaran, follow-up penagihan.
  - **Dokumen**: arsip dokumen per pelanggan (lihat 4.5).
  - **Jalur (Route)**: perencanaan dan riwayat jalur FO (lihat 4.6).
  - **Timeline**: riwayat aktivitas pelanggan.
- Admin dapat membuat, mengedit, dan menghapus pelanggan.

### 4.4 Monitoring Billing
- Tampilan spreadsheet/tabel per tahun dan ISP.
- Setiap baris = satu pelanggan aktif; setiap kolom = satu bulan.
- Sel menampilkan status invoice: `lunas`, `belum_bayar`, `terlambat`, `belum_ditagih`.
- Filter: tahun, ISP, status.
- Tampilan fullscreen tersedia untuk kemudahan operasional.
- Data monitoring diperbarui otomatis saat dokumen invoice diunggah.

### 4.5 Arsip Dokumen (per Pelanggan)
- Dokumen dikelola dari konteks pelanggan, bukan dari halaman global.
- Jenis dokumen (`jenis_dokumen`):
  - `permohonan`, `penawaran`, `tanggapan`, `hasil_nego`, `BAK`, `kontrak`, `invoice`, `perpanjangan`, `pemutusan`, `lainnya`
- Upload dokumen memicu otomasi bisnis:
  - `kontrak` → buat/perbarui entri kontrak, pelanggan menjadi monitorable.
  - `invoice` → buat/link record invoice, masuk ke monitoring bulanan.
  - `perpanjangan` → perpanjang kontrak atau buat versi kontrak baru.
  - `pemutusan` → set status pelanggan ke `nonaktif`, terminasi kontrak aktif.
- Kolom tabel dokumen: Jenis, Nomor Dokumen, Tanggal, File, Aksi.
- Filter chip: Semua, Kontrak, Invoice, BAK, Pemutusan.
- Label warna: Kontrak (biru), Invoice (hijau), Pemutusan (merah).

### 4.6 Route Planner FO (Jalur Fiber Optik)
- Perencanaan jalur berbasis peta menggunakan **Valhalla** routing engine.
- Data peta: OSM Sulawesi (`sulawesi.osm.pbf`).
- Setiap pelanggan memiliki versi jalur (`CustomerRouteVersion`) dengan titik-titik (`CustomerRoutePoint`):
  - Tipe titik: `awal`, `transit`, `tujuan`.
  - Status aliran: `aktif`, `nonaktif`, `gangguan`.
- Mode perubahan jalur: `initial` (pertama kali) dan `ubah_jalur` (revisi).
- Riwayat perubahan jalur tersimpan lengkap dengan snapshot sebelum dan sesudah.
- Tersedia tampilan fullscreen untuk peta.
- Teknisi memiliki akses penuh ke fitur ini.

### 4.7 Tempat Sampah
- Pelanggan dan ISP yang dihapus masuk ke Tempat Sampah (soft delete).
- Admin dapat memulihkan atau menghapus permanen.

---

## 5. Model Data Utama

| Entitas | Deskripsi |
|---|---|
| `User` | Akun pengguna dengan role: `admin`, `teknisi`, `isp` |
| `Isp` | Data ISP mitra, paket, periode kontrak, status |
| `IspContractRow` | Baris kontrak ISP per periode dengan status renewal |
| `IspRenewalFollowUp` | Follow-up proses renewal kontrak ISP |
| `Customer` | Data pelanggan/tenant, status, kode unik |
| `CustomerIspMembership` | Relasi many-to-many pelanggan ↔ ISP |
| `Contract` | Kontrak pelanggan dengan periode dan alokasi core |
| `ContractVersion` | Versi/revisi kontrak (perpanjangan) |
| `ContractVersionRenewalFollowUp` | Follow-up renewal versi kontrak pelanggan |
| `Document` | Arsip dokumen per pelanggan, terhubung ke kontrak/invoice |
| `Invoice` | Record invoice per periode, status pembayaran |
| `InvoiceFollowUp` | Follow-up penagihan invoice |
| `CustomerRouteVersion` | Versi jalur FO per pelanggan |
| `CustomerRoutePoint` | Titik-titik dalam jalur FO |
| `CustomerRouteHistory` | Riwayat perubahan jalur dengan snapshot |

---

## 6. Arsitektur Teknis

| Komponen | Teknologi |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Backend | NestJS (TypeScript) |
| Database | PostgreSQL via Prisma ORM |
| Routing Engine | Valhalla (OSM-based, Sulawesi) |
| Containerisasi | Docker Compose |
| Web Server (FE) | Nginx |

### Struktur Backend (NestJS Modules)
- `auth` — autentikasi login, JWT/session
- `customers` — CRUD pelanggan, kontrak, invoice, route
- `isps` — CRUD ISP, contract rows, renewal
- `documents` — upload dan manajemen dokumen
- `monitoring` — proyeksi billing dan alerts
- `prisma` — database service layer

### Struktur Frontend (Feature-based)
- `features/login` — halaman autentikasi
- `features/dashboard` — ringkasan dan alert
- `features/pelanggan` — manajemen pelanggan, detail, route planner
- `features/monitoring` — spreadsheet monitoring billing
- `features/sampah` / `features/trash` — tempat sampah
- `roles/admin`, `roles/isp`, `roles/teknisi` — konfigurasi menu dan rute per role

### API Utama
```
GET    /api/health
POST   /api/auth/login

GET    /api/customers
POST   /api/customers
GET    /api/customers/:id
PUT    /api/customers/:id
DELETE /api/customers/:id
GET    /api/customers/:id/compliance-status
GET    /api/customers/:id/timeline
GET    /api/customers/:id/documents
POST   /api/customers/:id/documents
DELETE /api/customers/:id/documents/:docId

GET    /api/isps
POST   /api/isps
GET    /api/isps/:id
PUT    /api/isps/:id
DELETE /api/isps/:id

GET    /api/monitoring/billing?year=&isp=&status=
GET    /api/monitoring/alerts?year=
```

---

## 7. Aturan Bisnis

1. **Upload `pemutusan`** → status pelanggan otomatis menjadi `nonaktif`, kontrak aktif di-terminate.
2. **Upload `perpanjangan`** → perpanjang end date kontrak aktif atau buat `ContractVersion` baru, status tetap `aktif`.
3. **Upload `kontrak`** → buat entri `Contract` baru (jika belum ada kontrak aktif) atau versi baru, pelanggan masuk monitoring billing.
4. **Upload `invoice`** → buat/link record `Invoice`, sel monitoring bulan terkait diperbarui.
5. **Upload `BAK`** → terhubung ke `ContractVersion` sebagai dokumen serah terima.
6. Dokumen selalu terikat ke pelanggan; opsional terikat ke kontrak atau versi kontrak.
7. Invoice memiliki siklus follow-up: `warning` → `sent` → `completed`.
8. Renewal ISP memiliki siklus: `active` → `warning` → `pending` → `renewed` / `terminated`.
9. Pelanggan yang dihapus masuk soft delete (Tempat Sampah), bukan hard delete langsung.

---

## 8. Persyaratan Non-Fungsional

| Aspek | Ketentuan |
|---|---|
| **Pengguna** | Dirancang untuk 1–5 pengguna internal secara bersamaan |
| **Keamanan** | Autentikasi wajib, akses berbasis role (RBAC), password di-hash |
| **Performa** | Halaman monitoring harus load < 3 detik untuk data 1 tahun penuh |
| **Ketersediaan** | Dijalankan via Docker Compose, dapat di-deploy di server lokal/VPS |
| **Skalabilitas** | Arsitektur modular NestJS memungkinkan penambahan modul tanpa refactor besar |
| **Integritas Data** | Cascade delete pada relasi pelanggan → kontrak → dokumen → invoice |
| **Audit Trail** | Riwayat perubahan jalur tersimpan lengkap dengan snapshot JSON |

---

## 9. Batasan & Asumsi

- Sistem ini adalah aplikasi **internal**, bukan publik.
- Satu instance sistem melayani satu organisasi (KIMA).
- File dokumen disimpan sebagai URL (diasumsikan menggunakan object storage atau file server eksternal).
- Routing FO hanya mencakup wilayah **Sulawesi** berdasarkan data OSM yang tersedia.
- Tidak ada fitur notifikasi real-time (push/email) pada versi awal; alert ditampilkan di UI saja.
- Valhalla routing engine memerlukan build awal yang memakan waktu beberapa menit saat pertama kali dijalankan.

---

## 10. Roadmap Implementasi

### Fase 1 — Core (Selesai / In Progress)
- [x] Autentikasi login dengan role-based access
- [x] CRUD ISP dan Pelanggan
- [x] Upload dan arsip dokumen per pelanggan
- [x] Monitoring billing spreadsheet
- [x] Tempat Sampah (soft delete)

### Fase 2 — Otomasi & Kontrak
- [x] Versi kontrak (perpanjangan)
- [x] Follow-up renewal ISP dan kontrak pelanggan
- [x] Otomasi status pelanggan berdasarkan jenis dokumen
- [x] Route planner FO dengan Valhalla

### Fase 3 — Kecerdasan Operasional
- [ ] Alert dashboard: kontrak mendekati expired, invoice belum ditagih
- [ ] Timeline aktivitas pelanggan yang lengkap
- [ ] Notifikasi terjadwal (email/in-app) untuk kontrak expiring
- [ ] Laporan dan analitik arsip dokumen

---

## 11. Glosarium

| Istilah | Definisi |
|---|---|
| ISP | Internet Service Provider — mitra penyedia jaringan |
| Tenant / Pelanggan | Pengguna layanan yang dikontrak melalui ISP |
| BAK | Berita Acara Kesepakatan — dokumen serah terima |
| Core | Alokasi serat optik (dedicated atau sharing) |
| Renewal | Proses perpanjangan kontrak ISP atau pelanggan |
| Pemutusan | Terminasi kontrak/layanan pelanggan |
| FO | Fiber Optik |
| Valhalla | Open-source routing engine berbasis OSM |
