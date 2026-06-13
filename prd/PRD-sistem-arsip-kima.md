# Product Requirements Document
# Sistem FO KIMA — Document Archiving & Tenant Monitoring System

**Versi:** 1.5  
**Tanggal:** 2026-06-02  
**Status:** Active Development

---

## 1. Latar Belakang

Sistem FO KIMA adalah aplikasi internal untuk mengelola arsip dokumen, monitoring kontrak, monitoring billing, dan data operasional fiber optik antara KIMA, ISP mitra, dan pelanggan/tenant.

Operasional sebelumnya tersebar di dokumen, spreadsheet, dan pencatatan manual. Sistem ini menyatukan data pelanggan, ISP, kontrak, BAK, invoice, dan jalur FO ke dalam satu platform berbasis web agar status kerja sama dan dokumen dapat dipantau dengan konsisten.

---

## 2. Tujuan Produk

- Menyediakan arsip dokumen terpusat untuk pelanggan dan ISP.
- Menampilkan status kontrak, periode berjalan, paket, invoice, dan dokumen secara akurat.
- Mendukung monitoring billing bulanan berbasis data invoice.
- Mendukung pengelolaan proses renewal/perpanjangan kontrak dan follow-up.
- Mendukung perencanaan dan riwayat jalur fiber optik.
- Mengurangi ambiguitas data dengan aturan bisnis kontrak yang jelas.

---

## 3. Pengguna & Peran

| Peran | Deskripsi | Kapabilitas Utama |
| --- | --- | --- |
| **Super Admin** | Pengelola penuh sistem | CRUD ISP, CRUD pelanggan, kelola kontrak, dokumen, invoice, route, monitoring, akses rancangan tempat sampah, dan menerima semua notifikasi operasional |
| **Admin** | Pengelola operasional kontrak | Mengelola operasional sesuai kebutuhan aplikasi dan menerima notifikasi masa/perpanjangan kontrak pelanggan saja |
| **Teknisi** | Staf operasional/lapangan | Melihat data pelanggan dan monitoring operasional, route planner FO, dan akses **Tempat Sampah** (lihat item terhapus) — tanpa hak buat/ubah/hapus entitas |
| **ISP** | Mitra ISP | Melihat data terkait ISP dan pelanggan yang relevan secara read-only |

Autentikasi menggunakan Supabase Auth. Akses aplikasi dibatasi berdasarkan role di frontend dan Supabase Row Level Security. Untuk role ISP, akses data dibatasi berdasarkan mapping `1 akun ISP = 1 entitas ISP` melalui tabel `public.isp_user_accounts`.

Credential awal akun ISP dikelola sebagai data operasional internal dan sinkronisasi ke Supabase Auth dilakukan melalui script provisioning yang direview.

---

## 4. Flow Bisnis Utama

### 4.1 Hubungan KIMA, ISP, dan Pelanggan

- ISP adalah vendor/mitra penyedia layanan atau pihak yang menaungi kontrak pelanggan tertentu.
- Pelanggan/tenant adalah klien akhir yang menerima layanan dari ISP/vendor.
- Pelanggan/tenant dapat terhubung ke satu atau lebih ISP melalui relasi membership.
- Data pelanggan menjadi pusat untuk kontrak, dokumen, invoice, route, dan timeline aktivitas.
- Contoh mapping yang benar: `PT Cendikia Global Solusi` adalah ISP/vendor, sedangkan `PT Bank Tabungan Negara (Persero)` dan `PT Karya Teknik Mulia (PT Wastec International)` adalah pelanggan/tenant.

### 4.2 Awal Kerja Sama Pelanggan

- `customers.contract_start_date` menyimpan tanggal pertama kali pelanggan bekerja sama dengan KIMA.
- Tanggal ini ditampilkan sebagai **Periode Awal Kontrak**.
- Nilai ini tidak sama dengan periode berjalan setiap kontrak, dan tidak boleh dihapus dari tampilan karena dipakai untuk mengetahui awal hubungan bisnis.
- Biaya aktivasi hanya dikenakan satu kali di awal kerja sama.
- Biaya aktivasi disimpan di data pelanggan, bukan di setiap kontrak.
- Jika satu ISP/vendor memiliki beberapa pelanggan, biaya aktivasi dicatat per pelanggan yang memang dikenakan biaya aktivasi.

### 4.3 Kontrak Pelanggan

- `contracts` merepresentasikan dokumen kontrak/BAK/legal yang nyata.
- Satu row `contracts` dibuat ketika memang ada dokumen kontrak/BAK/amendment/perpanjangan yang nyata.
- Tidak ada pembuatan kontrak otomatis hanya karena pergantian tahun.
- `contracts` adalah sumber kebenaran untuk:
  - nomor kontrak,
  - periode berjalan kontrak,
  - paket pelanggan,
  - jumlah dedicated core,
  - sharing ratio.
- Kontrak terbaru berdasarkan periode adalah **Kontrak Beroperasi**.
- Kontrak lama tetap ditampilkan sebagai **Riwayat Perubahan**.
- Dalam tampilan operasional, satu kerja sama induk dapat memiliki beberapa baris periode yang ditumpuk dari periode lama ke periode baru.
- Baris paling atas adalah periode aktif saat ini, sedangkan baris di bawahnya tetap dipertahankan sebagai histori perpanjangan.

### 4.4 Versi Kontrak Pelanggan

- `contract_versions` adalah snapshot/revisi/amendment opsional dari sebuah dokumen kontrak.
- `contract_versions` bukan sumber utama untuk baris kontrak normal.
- Jika dipakai, version harus tetap konsisten dengan parent `contracts` untuk versi terbaru.
- Version lama boleh menyimpan histori perubahan dalam satu dokumen kontrak, misalnya perubahan rasio dari `1/32` ke `1/8` dalam kasus amendment yang nyata.
- `contract_versions` juga dipakai untuk mencatat perubahan paket di tengah periode aktif, selama perubahan tersebut memang disetujui admin dan diberlakukan sebagai amendment yang sah.
- Untuk renewal/perpanjangan, `contract_versions` dipakai sebagai lapisan histori per periode:
  - baris lama ditandai selesai/expired/renewed sesuai keputusan bisnis,
  - baris baru dibuat sebagai periode aktif berikutnya,
  - periode awal kontrak tetap merujuk ke kerja sama awal pelanggan, bukan direset saat renewal.
- Urutan baris renewal harus merepresentasikan kronologi periode: baris terbaru tampil di atas, baris lama tetap tersimpan di bawahnya.

### 4.5 Ubah / Upgrade Paket

- Upgrade paket adalah perubahan paket pelanggan yang terjadi saat kontrak masih berjalan.
- Upgrade paket berbeda dari renewal/perpanjangan. Renewal menambah baris periode baru saat masa kontrak lama berakhir, sedangkan upgrade paket mengubah paket pada kontrak yang masih aktif.
- Alur ini hanya dapat dilakukan oleh Admin dari detail pelanggan/lokasi pada tab Kontrak.

| Tahap | Kondisi | Output Sistem | Aturan |
| --- | --- | --- | --- |
| Inisiasi | Admin memilih `Ubah / Upgrade Paket` | Modal perubahan paket tampil | Hanya tersedia pada detail pelanggan/lokasi |
| Input | Admin mengisi tanggal perubahan, paket baru, nominal, dan alasan | Form siap diproses | Tanggal wajib diisi dan tidak boleh melewati akhir kontrak aktif |
| Validasi paket | Paket baru dipilih `core` atau `sharing_core` | Sistem menerima input valid | `core` wajib punya `core_total > 0`; `sharing_core` wajib punya `sharing_ratio` |
| Penentuan efektif | Sistem menghitung paket baru aktif mulai bulan berikutnya | Paket lama tetap berlaku sampai akhir bulan berjalan | Tanggal efektif paket baru adalah hari pertama bulan berikutnya |
| Pencatatan histori | Sistem membuat `contract_versions` baru | Histori perubahan paket tersimpan | Jika belum ada version, sistem boleh membuat baseline lebih dulu |
| Penutupan versi lama | Versi aktif sebelumnya ditutup | Riwayat tidak hilang | Versi lama tidak dihapus, hanya diakhiri pada akhir bulan berjalan |
| Penyesuaian billing | Invoice belum lunas pada periode efektif baru diperbarui | Nominal invoice menyesuaikan paket baru | Invoice lunas atau histori tidak diubah |

- Nominal bulanan wajib lebih dari 0.
- Nominal tahunan dapat dihitung dari nominal bulanan jika tidak diisi manual.
- Alasan perubahan wajib tercatat, minimal sebagai alasan standar `ubah_paket`.

### 4.6 Paket dan Jumlah Core

Paket pelanggan memiliki dua bentuk:

| Paket | Field utama | Aturan |
| --- | --- | --- |
| `core` | `core_total` | `core_total > 0`, ratio kosong |
| `sharing_core` | `sharing_ratio` | ratio terisi seperti `1/32`, `core_total` kosong atau `0` |

Aturan penting:

- Perubahan paket hanya terjadi jika ada dokumen kontrak/BAK/amendment yang nyata.
- Tidak ada asumsi bahwa paket berubah otomatis setiap tahun.
- Tampilan detail pelanggan harus membaca paket dari kontrak berjalan/terbaru.
- Tab Kontrak harus menampilkan paket sesuai masing-masing row `contracts`.

### 4.7 Dokumen

- Dokumen selalu terikat ke pelanggan.
- Dokumen dapat opsional terikat ke kontrak, versi kontrak, atau invoice.
- Jenis dokumen utama:
  - `permohonan`,
  - `penawaran`,
  - `tanggapan`,
  - `hasil_nego`,
  - `BAK`,
  - `kontrak`,
  - `invoice`,
  - `perpanjangan`,
  - `pemutusan`,
  - `lainnya`.
- Dokumen kontrak/BAK menjadi bukti legal untuk row `contracts`.
- Dokumen invoice menjadi dasar monitoring billing.

### 4.8 Invoice dan Monitoring Billing

- Invoice dibuat per periode tagihan berdasarkan baris kontrak aktif yang sedang berjalan.
- Monitoring billing menampilkan status invoice per pelanggan dan bulan.
- Status invoice yang digunakan:
  - `lunas`,
  - `belum_bayar`,
  - `terlambat`,
  - `belum_ditagih`.
- Follow-up invoice digunakan untuk mencatat proses penagihan.
- Saat renewal menghasilkan baris periode baru, invoice periode baru harus mengikuti baris aktif terbaru.
- Invoice pada baris lama tidak dihapus; invoice lama tetap menjadi histori dan dapat dipindahkan ke `history` bila periode baris lama sudah selesai atau sudah digantikan baris baru.
- Jika renewal disetujui sebelum periode lama benar-benar berakhir, invoice yang belum dibayar pada periode efektif berikutnya harus disesuaikan ke baris baru tanpa mengubah histori pembayaran yang sudah lunas.
- Nominal invoice tetap mengikuti paket dan periode pada baris aktif yang berlaku saat invoice itu dibuat.

#### Contoh dataset PT Cendikia Global Solusi

Data PT Cendikia Global Solusi digunakan sebagai contoh flow bisnis aktual:

| Komponen | Nilai |
| --- | --- |
| ISP/vendor | PT Cendikia Global Solusi |
| Total pelanggan | 2 |
| Pelanggan 1 | PT Bank Tabungan Negara (Persero) |
| Pelanggan 2 | PT Karya Teknik Mulia (PT Wastec International) |
| Total kontrak | 8 |
| Total invoice | 96 |
| Nilai invoice bulanan | Rp 250.000 per kontrak |
| Grand total invoice | Rp 24.000.000 |
| Total biaya aktivasi | Rp 5.000.000 |
| Status invoice | Semua lunas |

Periode invoice untuk contoh tersebut:

| Pelanggan | Periode invoice pertama | Periode invoice terakhir | Jumlah invoice |
| --- | --- | --- | --- |
| PT Bank Tabungan Negara (Persero) | Juli 2022 | Juni 2026 | 48 |
| PT Karya Teknik Mulia (PT Wastec International) | Agustus 2022 | Juli 2026 | 48 |

### 4.9 Renewal dan Pemutusan

- Renewal/perpanjangan adalah proses bisnis yang dapat menghasilkan follow-up, dokumen perpanjangan, dan pada tahap akhir menghasilkan baris periode baru yang tetap terhubung ke kerja sama awal.
- Follow-up renewal mencatat proses administratif sebelum keputusan lanjut atau berhenti.
- Dokumen `pemutusan` menandai layanan/kontrak sebagai berhenti atau nonaktif sesuai konteks bisnis.

| Tahap | Kondisi | Output Sistem | Aturan |
| --- | --- | --- | --- |
| Pemantauan | Kontrak mendekati akhir periode | Alert renewal muncul | Peringatan dipakai untuk memulai tindak lanjut |
| Pengajuan | Surat perpanjangan dibuat dan diupload | Follow-up renewal tercatat | Dokumen harus nyata, bukan sekadar placeholder |
| Respons lokasi | Lokasi memberi tanggapan | Status follow-up diperbarui | Bisa lanjut ke perpanjangan atau penutupan |
| Persetujuan | Renewal disetujui secara bisnis dan legal | Baris periode baru dibuat | Hanya jika ada dokumen legal yang valid |
| Implementasi kontrak | Baris baru ditambahkan di atas baris lama | Baris lama menjadi histori, baris baru menjadi aktif | Periode awal kontrak tetap sama, periode berjalan berganti ke periode baru |
| Sinkron invoice | Baris baru aktif | Invoice periode baru mengikuti baris aktif terbaru | Invoice lama tetap histori; invoice aktif tidak boleh menimpa histori lunas |
| Penutupan | Renewal ditolak atau layanan dihentikan | Dokumen `pemutusan` dicatat | Layanan/kontrak dianggap berhenti atau nonaktif |

- Renewal follow-up dan pembuatan baris periode baru adalah dua tahap berbeda:
  - follow-up renewal dipakai untuk komunikasi, upload berkas, dan tanggapan lokasi
  - pembuatan baris periode baru hanya terjadi setelah renewal dinyatakan disetujui
- Pada implementasi UI yang ada, jalur yang terlihat saat ini baru mengelola follow-up renewal dan dokumen perpanjangan; PRD ini menegaskan bahwa hasil bisnis akhirnya adalah baris periode baru di atas baris lama, bukan kontrak induk baru yang memutus histori kerja sama awal.

---

## 5. Modul & Fitur

### 5.1 Dashboard

- Ringkasan jumlah pelanggan, ISP, invoice, dan kontrak.
- Alert operasional untuk invoice belum ditagih, kontrak mendekati akhir periode, dan dokumen yang perlu ditindaklanjuti.
- Dashboard menampilkan ringkasan alert prioritas tinggi dari Pusat Tindak Lanjut agar admin bisa memproses hal yang paling mendesak lebih dahulu.

### 5.2 Manajemen ISP

- Daftar ISP dengan status: `aktif`, `nonaktif`, `expired`, `berhenti`.
- Detail ISP menampilkan informasi umum, paket, jumlah, periode kontrak, logo, file kontrak, customer terkait, dan renewal follow-up.
- Admin dapat membuat, mengedit, dan menghapus ISP.
- Teknisi/ISP dapat melihat sesuai hak akses.

### 5.3 Manajemen Pelanggan

Detail pelanggan terdiri dari tab:

- **Overview**: informasi umum, status, paket berjalan, biaya aktivasi, periode awal kontrak, periode berjalan.
- **Kontrak**: daftar baris kontrak berurutan dari kerja sama awal sampai renewal terbaru, termasuk status BAK, periode, paket, jumlah, renewal follow-up, invoice yang terkait ke baris aktif, dan riwayat upgrade paket/amendment.
- **Invoice**: daftar invoice dan status pembayaran.
- **Dokumen**: arsip dokumen pelanggan.
- **Jalur**: perencanaan dan riwayat jalur FO.
- **Timeline**: riwayat aktivitas pelanggan.

### 5.4 Monitoring Billing

- Tampilan spreadsheet per tahun dan ISP.
- Baris mewakili pelanggan; kolom mewakili bulan.
- Data diperbarui berdasarkan invoice dan status pembayaran.

### 5.5 Route Planner FO

- Perencanaan jalur berbasis peta menggunakan Valhalla.
- Setiap pelanggan dapat memiliki versi jalur dan titik route.
- Riwayat perubahan jalur disimpan agar perubahan teknis dapat diaudit.

### 5.6 Tempat Sampah

- Modul Tempat Sampah sudah terhubung ke database (bukan lagi mock). Penghapusan entitas utama memakai **soft delete** via kolom `deleted_at` dan `deleted_by`.
- Soft delete diterapkan pada entitas utama: `isps`, `customers`, `contracts`, `contract_versions`, `invoices`, `documents`, `customer_route_versions`, `customer_route_points`, dan `isp_contract_rows`.
- Semua query list/monitoring utama memfilter `deleted_at IS NULL` sehingga item terhapus tidak muncul di tampilan aktif.
- Halaman Tempat Sampah mendukung **lihat item terhapus, pulihkan (restore), hapus permanen (hard delete), dan kosongkan sampah**, dengan statistik per jenis entitas.
- Menghapus ISP melakukan **cascade soft delete** ke pelanggan terkait. Audit penghapusan tersimpan pada `deleted_at`/`deleted_by`.
- Belum termasuk (lihat roadmap): auto-cleanup item lama, soft delete untuk seluruh tabel relasi anak, dan operasi bulk restore/delete.

### 5.7 Tindak Lanjut (Pusat Notifikasi/Aksi)

- Pusat notifikasi operasional terpusat untuk hal-hal yang perlu dibaca atau ditindaklanjuti.
- Sumber notifikasi mencakup: kontrak mendekati/lewat periode, invoice perlu perhatian/belum di-setup/belum diupload/jatuh tempo, jalur FO perlu perhatian/setup, biaya aktivasi, serta kontrak/dokumen/perpanjangan ISP.
- Pengiriman notifikasi berdasarkan role: **Super Admin** menerima semua notifikasi operasional; **Admin** hanya menerima notifikasi masa/perpanjangan kontrak pelanggan; **Teknisi** menerima notifikasi teknis/jalur; **ISP** menerima notifikasi yang terkait dengan ISP-nya.
- Tiap item memiliki tingkat keparahan (`critical`/`warning`/`info`) dan status baca/selesai (`unread`/`read`/`resolved`), dengan aksi **Buka**, **Tandai Dibaca**, dan **Tandai Selesai**.
- Mendukung pencarian, filter berdasarkan tipe/status, dan pagination.

| Kategori | Kondisi | Severity | Tindakan awal | Catatan |
| --- | --- | --- | --- | --- |
| Kontrak | Kontrak aktif masuk periode H-3 bulan sebelum akhir kontrak dan surat perpanjangan belum diupload | warning | Buat dan upload surat perpanjangan | Menandai awal tindak lanjut renewal |
| Kontrak | Surat perpanjangan sudah diupload tetapi belum ada tanggapan lokasi | warning | Follow up ke lokasi | Berlaku pada rentang H-2 bulan |
| Kontrak | Mendekati H-1 bulan dan belum ada tanggapan | warning | Follow up manual | Dipakai saat renewal masih menggantung |
| Invoice | Invoice belum ditagih atau belum diupload | warning | Upload atau setup invoice | Masuk pusat tindak lanjut sebelum jatuh tempo |
| Invoice | Invoice berstatus `terlambat` | critical | Verifikasi dan kejar pembayaran | Diprioritaskan paling tinggi |
| Jalur FO | Status jalur `perbaikan` atau `maintenance` | warning | Pantau dan selesaikan gangguan | Menandakan jalur masih perlu perhatian |
| Jalur FO | Status jalur `gangguan` | critical | Eskalasi penanganan jalur | Menandakan gangguan operasional aktif |
| Umum | Informasi yang belum memerlukan tindakan mendesak | info | Cukup dibaca | Tidak memerlukan eskalasi |

- Aturan prioritas alert:
  - `critical` dipakai untuk kondisi yang sudah mengganggu operasi atau melewati tenggat penting.
  - `warning` dipakai untuk kondisi yang sudah perlu ditindaklanjuti tetapi masih dalam batas normal operasional.
  - `info` dipakai untuk informasi yang sifatnya pemberitahuan dan belum memerlukan tindakan mendesak.
- Aturan resolusi:
  - Alert boleh ditandai `read` setelah dibuka oleh user.
  - Alert hanya dianggap selesai jika tindakan bisnis sudah dilakukan dan dapat ditandai `resolved`.
  - Sistem boleh menyimpan lebih dari satu alert dari sumber berbeda untuk entitas yang sama selama konteks tindak lanjutnya berbeda.
- Aturan deduplikasi:
  - Satu alert logis tidak boleh muncul berulang tanpa perubahan status sumber datanya.
  - Jika status sumber berubah, alert baru boleh dibentuk untuk merefleksikan kondisi terkini.

### 5.8 Log Aktivitas (Audit Trail)

- Riwayat audit aksi penting pengguna pada entitas utama.
- Mencatat aksi seperti pembuatan, perubahan, penghapusan, dan pemulihan (restore) untuk pelanggan, ISP, kontrak, invoice, dokumen, dan jalur.
- Untuk aksi perubahan, sistem menyimpan ringkasan diff **sebelum/sesudah** per field yang berubah sehingga perubahan data dapat ditelusuri.
- Menjadi implementasi dari kebutuhan keterlacakan; tab **Timeline** pada detail pelanggan (§5.3) menampilkan aktivitas yang relevan dengan pelanggan tersebut.

---

## 6. Model Data Utama

| Entitas | Deskripsi |
| --- | --- |
| `users` / Supabase Auth | Akun pengguna dan role akses |
| `isp_user_accounts` | Mapping akun login Supabase Auth ke entitas ISP (`1 akun ISP = 1 entitas ISP`) sebagai dasar pembatasan akses data untuk role ISP |
| `isps` | Data ISP mitra, paket, periode, status, dan metadata billing |
| `isp_contract_rows` | Baris kontrak/periode ISP bila tersedia |
| `isp_renewal_follow_ups` | Follow-up renewal kontrak ISP |
| `customers` | Data pelanggan, status, kode unik, awal kerja sama, biaya aktivasi, dan catatan |
| `customer_isp_memberships` | Relasi many-to-many pelanggan dengan ISP |
| `contracts` | Dokumen kontrak/BAK/legal pelanggan; sumber kebenaran nomor kontrak, periode, dan paket |
| `contract_versions` | Snapshot/revisi/amendment opsional dari kontrak |
| `contract_version_renewal_follow_ups` | Follow-up renewal kontrak pelanggan |
| `documents` | Arsip dokumen pelanggan/kontrak/versi kontrak/invoice |
| `invoices` | Invoice per periode tagihan dan sumber status monitoring billing |
| `invoice_follow_ups` | Follow-up penagihan invoice |
| `customer_route_versions` | Versi jalur FO pelanggan |
| `customer_route_points` | Titik awal/transit/tujuan jalur FO |
| `customer_route_history` | Riwayat perubahan jalur FO |

### 6.1 Aturan Schema Supabase Aktual

Bagian ini mendokumentasikan aturan database production yang harus diikuti oleh script insert/update manual.

#### `isps`

- `name` adalah nama ISP/vendor.
- `status` menggunakan status operasional seperti `aktif`, `nonaktif`, `expired`, atau `berhenti` sesuai kebutuhan tampilan.
- `paket` bertipe enum `isp_package_type`, sehingga nilai string harus di-cast eksplisit saat dipakai di SQL manual. Nilai yang digunakan script saat ini antara lain:
  - `core`
  - `shared`
- `billing_period_mode` digunakan untuk pola billing ISP, misalnya `monthly`.
- `activation_fee_amount` pada ISP bukan sumber utama biaya aktivasi pelanggan; biaya aktivasi operasional pelanggan tetap disimpan di `customers.activation_fee_amount`.

#### `customers`

- `customer_code` dipakai sebagai kode unik operasional untuk seed/upsert data produksi.
- `name` adalah nama pelanggan/tenant. Jika spreadsheet berisi nilai seperti `Core` pada kolom pelanggan, nilai tersebut diperlakukan sebagai nama pelanggan selama posisinya memang berada di kolom pelanggan.
- `isp_name` dipertahankan sebagai denormalisasi nama ISP untuk kompatibilitas tampilan, tetapi relasi utama pelanggan-ISP tetap melalui `customer_isp_memberships`.
- `contract_start_date` menyimpan awal kerja sama pertama pelanggan dengan KIMA.
- `activation_fee_amount` menyimpan biaya aktivasi pelanggan dan hanya diisi pada awal kerja sama atau ketika data aktivasi memang tersedia.

#### `customer_isp_memberships`

- Relasi pelanggan ke ISP bersifat many-to-many.
- Script produksi harus membuat membership jika belum ada, bukan hanya mengisi `customers.isp_name`.

#### `contracts`

- `contracts` adalah sumber utama untuk nomor kontrak, periode kontrak, status kontrak, dan paket kontrak.
- Satu kerja sama induk tetap dipertahankan sebagai identitas utama; renewal berikutnya tidak memutus identitas awal kerja sama.
- Kolom penting yang dipakai aplikasi dan script:
  - `customer_id`
  - `contract_number`
  - `start_date`
  - `end_date`
  - `core_type`
  - `core_total`
  - `sharing_ratio`
  - `status`
  - `billing_every`
  - `billing_unit`
- `status` bertipe enum `contract_status`; script manual harus cast nilai seperti `aktif` atau `expired` ke `contract_status` bila diperlukan.
- `core_type` bertipe enum/constraint `core_allocation_type` dengan nilai utama:
  - `core`
  - `sharing_core`
- Bentuk paket wajib konsisten:
  - Jika `core_type = 'core'`, maka `core_total > 0` dan `sharing_ratio` harus kosong/null.
  - Jika `core_type = 'sharing_core'`, maka `sharing_ratio` wajib terisi dan `core_total` kosong/null atau `0`.
- Paket kontrak baru boleh diwariskan dari kontrak sebelumnya hanya jika secara bisnis dikonfirmasi; secara default tidak boleh diasumsikan dari tahun sebelumnya.
- Jika renewal disetujui, row lama boleh ditandai history/expired/renewed, lalu row aktif baru dibuat sebagai baris periode berikutnya dengan `start_date`/`end_date` periode baru.

#### `contract_versions`

- `contract_versions` adalah snapshot/amendment opsional untuk menyimpan histori perubahan dalam satu kontrak.
- Dalam alur renewal, `contract_versions` dipakai sebagai representasi baris periode berurutan:
  - versi lama = histori periode yang sudah selesai,
  - versi baru = periode aktif terbaru,
  - versi awal tetap terhubung ke awal kerja sama pelanggan.
- Bentuk paket di versi kontrak harus konsisten dengan `contracts`.
- Jika dipakai untuk monitoring atau perbandingan nilai, field nominal mengikuti aturan data operasional yang berlaku pada import atau maintenance script.
- `monthly_amount` dan `yearly_amount` harus mengikuti paket yang berlaku pada periode versi tersebut.

#### `documents`

- Dokumen wajib memiliki `customer_id`, `jenis_dokumen`, `tanggal_dokumen`, dan `file_url`.
- Dokumen dapat terhubung ke kontrak, versi kontrak, atau invoice sesuai kebutuhan arsip.
- `jenis_dokumen` bertipe enum `document_type` dengan nilai:
  - `permohonan`
  - `penawaran`
  - `tanggapan`
  - `hasil_nego`
  - `BAK`
  - `kontrak`
  - `invoice`
  - `perpanjangan`
  - `pemutusan`
  - `lainnya`
- Untuk seed production, file dokumen boleh berupa placeholder URL hanya jika file asli belum tersedia dan kebutuhan import memang untuk metadata monitoring.

#### `invoices`

- Invoice adalah sumber kebenaran status monitoring bulanan.
- `period_month` harus berada di rentang `1` sampai `12`.
- `amount` tidak boleh kosong untuk invoice yang dibuat.
- Status invoice yang dipakai aplikasi:
  - `lunas`
  - `belum_bayar`
  - `terlambat`
  - `belum_ditagih`
- Status spreadsheet `-` dan `BT` dipetakan ke `belum_ditagih` untuk import monitoring.
- Jika data spreadsheet memecah tagihan tahun berikutnya tetapi memakai nomor kontrak yang sama, invoice tetap terhubung ke kontrak yang sama dan tidak membuat row `contracts` baru.
- Jika renewal melahirkan baris periode baru, invoice periode baru harus terhubung ke row/versi aktif terbaru.
- Invoice pada baris lama tidak boleh dihapus saat renewal; invoice lama tetap menjadi histori pembayaran.
- Jika baris lama sudah digantikan dan invoice di periode baris lama belum lunas, statusnya dapat menjadi `terlambat` atau dipindah ke histori sesuai tanggal efektif dan keputusan bisnis.

#### Follow-up dan Route

- `invoice_follow_ups` menyimpan follow-up penagihan invoice.
- `contract_version_renewal_follow_ups` menyimpan follow-up renewal pada level versi kontrak pelanggan.
- `isp_contract_rows` menyimpan data kontrak/periode ISP dan file BAK/kontrak pada level baris kontrak ISP.
- `isp_renewal_follow_ups` menyimpan follow-up renewal ISP.
- `customer_route_versions`, `customer_route_points`, dan `customer_route_history` menyimpan versi jalur, titik jalur, status flow, dan riwayat perubahan route FO.

### 6.2 Aturan Script Production

- Script production harus idempotent: aman dijalankan ulang tanpa membuat duplikasi customer, membership, kontrak, dokumen, atau invoice.
- Upsert customer sebaiknya menggunakan `customer_code`.
- Upsert kontrak sebaiknya menggunakan kombinasi `customer_id` dan `contract_number`.
- Upsert invoice sebaiknya menggunakan kombinasi `customer_id` dan `invoice_number`.
- Saat mengimport data renewal, script harus menambahkan baris periode baru tanpa menghapus histori baris lama dan tanpa menimpa invoice yang sudah lunas.
- Semua nilai enum di SQL manual harus di-cast eksplisit bila PostgreSQL tidak bisa infer tipe, misalnya `::isp_package_type`, `::contract_status`, atau `::core_allocation_type`.
- Nilai wajib database, terutama `contract_versions.yearly_amount`, harus selalu diisi. Jika spreadsheet kosong, script harus menghitung fallback dan mencantumkan asumsi perhitungannya.
- Perubahan data production harus disertai verification query di akhir script untuk membandingkan jumlah kontrak, jumlah invoice, total nominal, dan periode invoice pertama/terakhir.

---

## 7. Arsitektur Teknis

### 7.1 Arsitektur Saat Ini

Alur utama sistem saat ini:

```text
Frontend React/Vite
        |
        v
Supabase client / REST / RPC / Storage API
        |
        v
Supabase Auth + PostgreSQL + Row Level Security + Storage
```

Komponen pendukung:

- **Frontend**: React + Vite.
- **Backend utama**: Supabase penuh; aplikasi tidak memiliki backend Node/NestJS terpisah untuk alur utama.
- **Database**: Supabase PostgreSQL yang diakses melalui Supabase client, REST, RPC, dan script operasional yang dijalankan manual di Supabase SQL Editor.
- **Auth**: Supabase Auth.
- **Storage/File URL**: Supabase Storage atau URL file eksternal sesuai data.
- **Route planner**: Valhalla untuk kebutuhan peta/jalur FO.
- **API access layer**: `frontend/src/lib/api.js`, berfungsi sebagai mapper antara payload UI camelCase dan kolom Supabase snake_case.

Tidak ada service NestJS yang menjadi alur utama aplikasi saat ini. Direct PostgreSQL tidak menjadi pola akses aplikasi; direct database hanya boleh dipakai untuk kebutuhan administrasi/schema yang eksplisit dan tetap harus mengikuti review operasional.

### 7.2 Pola Akses Data Frontend dan Supabase

- Frontend tidak boleh mengirim payload form mentah langsung ke Supabase.
- Semua create/update harus melewati mapper di `frontend/src/lib/api.js` agar field UI seperti `contractNumber`, `billingEvery`, `responseStatus`, atau `activationFeeAmount` dikonversi ke kolom database yang benar.
- Untuk kebutuhan baca/tulis aplikasi, gunakan Supabase client/REST/RPC sesuai pola yang sudah ada, bukan koneksi PostgreSQL langsung.
- Field `updated_at` wajib dikirim pada tabel yang memiliki constraint `NOT NULL` dan tidak memiliki default database.
- List pelanggan memakai pagination server-side bertahap:
  - batch awal default 500 pelanggan;
  - batch berikutnya dimuat lewat tombol **Muat Lagi**;
  - pencarian/filter workspace berlaku pada data yang sudah dimuat.
- Query list awal pelanggan tidak mengambil invoice penuh. Data customer, kontrak, versi kontrak, dan status route diambil dengan query terpisah berbasis chunk untuk mengurangi payload nested besar.
- Monitoring billing mengambil customer aktif, kontrak, invoice tahun terkait, dan route status melalui batch query terpisah, bukan satu nested select besar.
- Detail pelanggan/ISP tetap boleh mengambil relasi lebih lengkap karena dibuka on-demand untuk satu entitas.
- Akun ISP dikelola dua tahap: frontend menyimpan email/password pada data ISP, lalu admin menjalankan script provisioning Auth untuk membuat/update `auth.users` dan mapping `public.isp_user_accounts`.

### 7.3 Struktur Project

```text
sistem-fo-kima/
├── frontend/              # React + Vite application
├── docs/                  # Dokumentasi teknis, operasional, deployment, analisis
├── prd/                   # Product requirements dan diagram bisnis
├── scripts/               # Script operasional Supabase/SQL/dev
└── infra/                 # Konfigurasi infrastruktur pendukung seperti Valhalla
```

### 7.4 Struktur Frontend

```text
frontend/src/
├── app/                   # Utilities dan shared app logic
├── components/            # Shared UI components
├── features/              # Feature pages: dashboard, login, pelanggan, monitoring, todos (Tindak Lanjut), activity (Log Aktivitas), trash (Tempat Sampah)
├── lib/                   # API/Supabase access layer
└── roles/                 # Route/menu per role
```

---

## 8. Persyaratan Non-Fungsional

| Aspek | Ketentuan |
| --- | --- |
| Pengguna | Dirancang untuk penggunaan internal oleh operator/tim kecil |
| Keamanan | Login wajib, role-based access, Supabase RLS |
| Integritas Data | Relasi kontrak, dokumen, invoice, dan customer harus konsisten |
| Keterlacakan | Dokumen dan timeline menyimpan histori aktivitas penting |
| Performa | List dan monitoring harus memakai index, batching, dan pagination agar tidak menarik payload besar sekaligus |
| Operasional | Script production dijalankan manual dan hati-hati melalui Supabase SQL Editor |

### 8.1 Penanganan Kredensial Akun ISP

> **Risiko diketahui:** ada mekanisme operasional untuk penyelarasan credential ISP dengan Supabase Auth yang harus diperlakukan sebagai data sensitif.

Ketentuan yang berlaku:

- Sumber kebenaran autentikasi tetap **Supabase Auth**.
- Akses data credential operasional harus dibatasi ketat.
- Nilai credential operasional tidak boleh ditampilkan di log, pesan error, hasil export, atau dibagikan di luar kanal operasional yang aman.
- **Arah perbaikan (roadmap):** hentikan penyimpanan credential operasional dalam bentuk yang bisa dipakai ulang setelah akun Auth berhasil dibuat, dan beralih ke alur reset/invite yang lebih aman.

---

## 9. Batasan & Asumsi

- Sistem digunakan internal oleh KIMA.
- Data production berada di Supabase.
- Backend aplikasi adalah Supabase penuh; perubahan fitur harus mengikuti pola Supabase client/REST/RPC/Storage yang sudah ada.
- Direct PostgreSQL bukan jalur aplikasi dan tidak digunakan untuk investigasi/operasi rutin kecuali diminta eksplisit untuk administrasi database.
- Dokumen/file dapat berupa URL eksternal atau storage yang dapat dibuka dari aplikasi.
- Tidak semua ISP harus memiliki data kontrak detail jika data belum tersedia.
- Perubahan data production harus melalui script/audit yang jelas.
- Valhalla hanya diperlukan untuk fitur route planner.
- Search/filter workspace saat ini bekerja pada data pelanggan yang sudah dimuat di browser. Search global lintas seluruh database membutuhkan endpoint/query server-side khusus.
- Index database mempercepat query, tetapi rate limit akibat terlalu banyak request tetap harus ditangani dengan batching, pagination, debounce, dan lazy loading detail.

---

## 10. Deployment & Operations

### 10.1 Local Development

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Frontend berjalan di:

```text
http://localhost:5173
```

### 10.2 Production

- Frontend dideploy ke **Vercel** sebagai static build (`frontend/dist`); konfigurasi build ada di `vercel.json` di root repo. Hosting static lain dapat dipakai selama mendukung SPA rewrite ke `index.html`.
- Backend/data menggunakan Supabase.
- Langkah deploy lengkap ada di `docs/deployment/DEPLOYMENT_GUIDE.md`.
- Script SQL production dijalankan manual melalui Supabase SQL Editor setelah direview.
- Index performa production tersedia di `scripts/maintenance/add-performance-indexes.sql` dan perlu dijalankan setelah review bila database mulai besar atau query monitoring terasa lambat.

### 10.3 Verifikasi Umum

```bash
npm --prefix frontend run lint
npm --prefix frontend run build
```

---

## 11. Roadmap Implementasi

### Fase 1 — Core Operasional

- [x] Login berbasis role.
- [x] CRUD pelanggan dan ISP.
- [x] Arsip dokumen pelanggan.
- [x] Monitoring billing.
- [x] Soft delete/tempat sampah production.

### Fase 2 — Kontrak, Invoice, dan Route

- [x] Detail kontrak pelanggan berbasis dokumen kontrak.
- [x] Follow-up invoice dan renewal.
- [x] Route planner FO.
- [x] Mapping Supabase direct access.

### Fase 3 — Penyempurnaan Operasional

- [x] Index query untuk list, monitoring, kontrak, invoice, route, dan follow-up.
- [x] Batching query dan pagination server-side bertahap pada list pelanggan.
- [x] Pusat Tindak Lanjut: notifikasi operasional terpusat dengan tingkat keparahan dan status baca/selesai (§5.7).
- [x] Log Aktivitas/audit trail: pencatatan aksi entitas utama dengan diff sebelum/sesudah (§5.8).
- [ ] Alert dashboard yang lebih lengkap.
- [ ] Timeline aktivitas per pelanggan yang lebih detail.
- [ ] Laporan/analitik dokumen dan billing.
- [ ] Search/filter server-side global untuk workspace pelanggan saat jumlah data melampaui batch awal.
- [x] Soft delete production dan restore flow untuk Tempat Sampah.
- [ ] Penyempurnaan Tempat Sampah: auto-cleanup item lama, soft delete untuk seluruh tabel relasi anak, dan bulk restore/delete.
- [ ] Notifikasi terjadwal bila dibutuhkan.

---

## 12. Glosarium

| Istilah | Definisi |
| --- | --- |
| ISP | Internet Service Provider / mitra penyedia jaringan |
| Pelanggan / Tenant | Pengguna layanan fiber optik |
| BAK | Berita Acara Kesepakatan/serah terima sesuai konteks dokumen |
| Core | Alokasi fiber dedicated |
| Sharing Core | Alokasi fiber berbagi, misalnya `1/32` |
| Periode Awal Kontrak | Tanggal awal kerja sama pertama pelanggan |
| Periode Berjalan | Periode kontrak aktif/terbaru |
| Contract | Dokumen kontrak/BAK/legal nyata pelanggan |
| Contract Version | Snapshot/revisi/amendment opsional dari kontrak |
| Renewal | Proses perpanjangan/kelanjutan kontrak |
| Pemutusan | Terminasi layanan/kontrak |
| FO | Fiber Optik |
| Valhalla | Routing engine berbasis OSM |
| Supabase | Platform backend untuk database, auth, storage, dan REST API |

---

**Dokumen ini terakhir diperbarui:** 2026-05-31  
**Versi:** 1.4  
**Status:** Active Development
