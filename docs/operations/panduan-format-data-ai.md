# Panduan Format Data untuk AI Input Operasional

Dokumen ini menjelaskan format data yang harus diberikan agar AI dapat:

- memahami apakah data adalah **ISP** atau **Lokasi**
- memahami apakah data adalah **kontrak baru**, **perpanjangan**, atau **koreksi**
- memasukkan data ke UI atau database tanpa salah tafsir

Dokumen ini dibuat dari kasus operasional nyata yang sebelumnya menimbulkan salah input, terutama pada pemisahan entitas **ISP** dan **Lokasi**.

---

## Tujuan

Gunakan panduan ini setiap kali memberikan data ke AI untuk:

- insert data baru
- perpanjangan kontrak
- upload dokumen dummy atau final
- update invoice
- ubah status kontrak atau status pembayaran
- verifikasi data existing

---

## Aturan Dasar Entitas

### 1. ISP

**ISP** adalah perusahaan penyedia layanan.

Contoh:

- `PT Indonesia Comnets Plus`
- `Telkom Indonesia (Persero) Tbk`

Field yang melekat ke ISP biasanya:

- nama ISP
- nomor kontrak ISP
- periode kontrak ISP
- dokumen kontrak ISP
- dokumen BAK ISP

### 2. Lokasi

**Lokasi** adalah titik layanan atau nama tenant yang menerima layanan dari ISP.

Contoh:

- `48 ODP`
- `PT Indomarco Prismatama`
- `PT Indomarco Prismatama (IDM Kasir)`

Field yang melekat ke Lokasi biasanya:

- nama lokasi / tenant
- ISP yang melayani lokasi itu
- paket layanan
- jumlah core atau rasio sharing
- nominal bulanan / tahunan
- invoice per periode

### 3. Aturan pemisahan yang wajib

Kalau data ditulis seperti ini:

`Telkom Indonesia (Persero) Tbk | 48 ODP | ...`

maka artinya:

- `Telkom Indonesia (Persero) Tbk` = **ISP**
- `48 ODP` = **Lokasi**

Bukan:

- lokasi = `Telkom Indonesia (Persero) Tbk`

---

## Format yang Wajib Dipakai Saat Memberi Data

Setiap kiriman data minimal harus memakai blok seperti ini:

```text
JENIS: ISP_BARU | LOKASI_BARU | PERPANJANGAN | UPDATE_INVOICE | UPDATE_STATUS | VERIFIKASI

ISP:
LOKASI:
PAKET:
JUMLAH_CORE:
RASIO_SHARING:
AWAL_KONTRAK:
PERIODE_MULAI:
PERIODE_AKHIR:
NOMOR_KONTRAK:
NOMINAL_BULANAN:
NOMINAL_TAHUNAN:
BIAYA_AKTIVASI:
NOMOR_INVOICE:
TANGGAL_INVOICE:
TANGGAL_JATUH_TEMPO:
STATUS_PEMBAYARAN:
CATATAN:
AKSI:
```

---

## Arti Setiap Field

| Field | Wajib | Keterangan |
| --- | --- | --- |
| `JENIS` | Ya | Tipe pekerjaan yang diminta ke AI |
| `ISP` | Ya | Nama perusahaan ISP |
| `LOKASI` | Tergantung | Wajib untuk data lokasi |
| `PAKET` | Ya | `CORE` atau `SHARING CORE` |
| `JUMLAH_CORE` | Wajib jika paket `CORE` | Angka saja, misal `48` |
| `RASIO_SHARING` | Wajib jika paket `SHARING CORE` | Misal `1/16`, `1/32` |
| `AWAL_KONTRAK` | Opsional tapi sangat dianjurkan | Tanggal dokumen kontrak awal |
| `PERIODE_MULAI` | Ya | Awal periode layanan |
| `PERIODE_AKHIR` | Ya | Akhir periode layanan |
| `NOMOR_KONTRAK` | Ya | Nomor kontrak/baris kontrak untuk periode itu |
| `NOMINAL_BULANAN` | Ya | Angka nominal bulanan |
| `NOMINAL_TAHUNAN` | Ya | Angka nominal tahunan |
| `BIAYA_AKTIVASI` | Ya | Isi `0` kalau tidak ada |
| `NOMOR_INVOICE` | Tidak selalu | Bisa satu atau banyak, pisahkan jelas |
| `TANGGAL_INVOICE` | Opsional | Jika ada |
| `TANGGAL_JATUH_TEMPO` | Opsional | Jika ada |
| `STATUS_PEMBAYARAN` | Sangat dianjurkan | Misal `lunas semua`, `belum lunas`, `campuran` |
| `CATATAN` | Opsional | Informasi tambahan |
| `AKSI` | Ya | Instruksi yang harus dilakukan AI |

---

## Nilai `JENIS` yang Dipakai

Gunakan salah satu nilai berikut:

- `ISP_BARU`
- `LOKASI_BARU`
- `PERPANJANGAN`
- `UPDATE_INVOICE`
- `UPDATE_STATUS`
- `UPLOAD_DOKUMEN`
- `VERIFIKASI`
- `KOREKSI_DATA`

---

## Template Siap Pakai

### 1. Template ISP baru

```text
JENIS: ISP_BARU
ISP: Telkom Indonesia (Persero) Tbk
AWAL_KONTRAK: 01-Jan-24
PERIODE_MULAI: 01-Jan-24
PERIODE_AKHIR: 31-Dec-24
NOMOR_KONTRAK: KIMA.PERU-013/DOP/III/2024 dan K.TEL.683/HK.810/DR7-10000000/2024
CATATAN: Ini entitas ISP, bukan lokasi
AKSI: Buat ISP baru dan siapkan agar bisa dipilih saat membuat lokasi
```

### 2. Template lokasi baru di bawah ISP

```text
JENIS: LOKASI_BARU
ISP: Telkom Indonesia (Persero) Tbk
LOKASI: 48 ODP
PAKET: CORE
JUMLAH_CORE: 48
AWAL_KONTRAK: 01-Jan-24
PERIODE_MULAI: 01-Jan-24
PERIODE_AKHIR: 31-Dec-24
NOMOR_KONTRAK: KIMA.PERU-013/DOP/III/2024 dan K.TEL.683/HK.810/DR7-10000000/2024
NOMINAL_BULANAN: 69600000
NOMINAL_TAHUNAN: 835200000
BIAYA_AKTIVASI: 0
NOMOR_INVOICE: INV-012/KIMA/FO/III/2024, INV-017/KIMA/FO/VI/2024, INV-072/KIMA/FO/IX/2024, INV-100/KIMA/FO/XII/2024, INV-034/KIMA/FO/III/2025
STATUS_PEMBAYARAN: belum dijelaskan
AKSI: Buat lokasi baru di bawah ISP tersebut
```

### 3. Template perpanjangan

```text
JENIS: PERPANJANGAN
ISP: Telkom Indonesia (Persero) Tbk
LOKASI: 48 ODP
PAKET: CORE
JUMLAH_CORE: 48
PERIODE_MULAI: 01-Jan-25
PERIODE_AKHIR: 31-Dec-25
NOMOR_KONTRAK: KIMA.BAK-795A/DOP/XII/2024 dan Nomor. K-Tel122474/HK.000/T5R-0C010000/2024
NOMINAL_BULANAN: 72000000
NOMINAL_TAHUNAN: 864000000
BIAYA_AKTIVASI: 0
NOMOR_INVOICE: INV-034/KIMA/FO/III/2025, 071/FO/7/25, 074/8/FO/25, 075/FO8/25
STATUS_PEMBAYARAN: belum dijelaskan
AKSI: Tambahkan versi kontrak/perpanjangan untuk lokasi ini
```

### 4. Template update status pembayaran

```text
JENIS: UPDATE_STATUS
ISP: PT Indonesia Comnets Plus
LOKASI: PT Indomarco Prismatama
NOMOR_KONTRAK: KIMA.BAK-36/DBO/FO/VIII/2023
STATUS_PEMBAYARAN: lunas semua
AKSI: Ubah semua invoice terkait menjadi lunas
```

### 5. Template upload dokumen

```text
JENIS: UPLOAD_DOKUMEN
ISP: PT Indonesia Comnets Plus
LOKASI: PT Indomarco Prismatama
NOMOR_KONTRAK: KIMA.BAK-36/DBO/FO/VIII/2023
CATATAN: upload dummy dulu
AKSI: Upload dummy untuk kontrak, BAK, atau dokumen perpanjangan sesuai kebutuhan UI
```

---

## Aturan Penulisan Angka dan Tanggal

### Angka

Gunakan angka polos tanpa format campuran.

Benar:

```text
NOMINAL_BULANAN: 74400000
NOMINAL_TAHUNAN: 892800000
BIAYA_AKTIVASI: 2500000
JUMLAH_CORE: 48
```

Hindari:

```text
74,400,000
74.400.000
Rp 74.400.000
```

### Tanggal

Gunakan salah satu format berikut secara konsisten:

- `01-Jan-24`
- `2024-01-01`

Kalau ada tanggal relatif seperti `hari ini`, `besok`, atau `yang terbaru`, sebutkan tanggal absolutnya juga.

---

## Aturan untuk Data Multi-Baris

Kalau satu lokasi punya beberapa periode kontrak, kirim per periode sebagai blok terpisah.

Contoh:

```text
JENIS: LOKASI_BARU
ISP: Telkom Indonesia (Persero) Tbk
LOKASI: 48 ODP
PAKET: CORE
JUMLAH_CORE: 48
PERIODE_MULAI: 01-Jan-24
PERIODE_AKHIR: 31-Dec-24
NOMOR_KONTRAK: KIMA.PERU-013/DOP/III/2024 dan K.TEL.683/HK.810/DR7-10000000/2024
NOMINAL_BULANAN: 69600000
NOMINAL_TAHUNAN: 835200000
BIAYA_AKTIVASI: 0
AKSI: buat periode awal

JENIS: PERPANJANGAN
ISP: Telkom Indonesia (Persero) Tbk
LOKASI: 48 ODP
PAKET: CORE
JUMLAH_CORE: 48
PERIODE_MULAI: 01-Jan-25
PERIODE_AKHIR: 31-Dec-25
NOMOR_KONTRAK: KIMA.BAK-795A/DOP/XII/2024 dan Nomor. K-Tel122474/HK.000/T5R-0C010000/2024
NOMINAL_BULANAN: 72000000
NOMINAL_TAHUNAN: 864000000
BIAYA_AKTIVASI: 0
AKSI: tambah versi 2
```

---

## Aturan Khusus Agar AI Tidak Salah Lagi

Sebelum data, selalu jelaskan salah satu kalimat ini bila relevan:

- `Ini ISP, bukan lokasi.`
- `Ini lokasi di bawah ISP tersebut.`
- `Ini perpanjangan dari lokasi yang sudah ada.`
- `Ini kontrak berhenti.`
- `Ini hanya verifikasi, jangan ubah data.`
- `Kalau UI sulit, lanjutkan via Supabase.`
- `Upload dummy dulu untuk dokumen.`

Kalimat-kalimat itu sangat membantu AI menentukan jalur kerja yang benar.

---

## Contoh Kiriman Ideal

```text
Ini ISP, bukan lokasi.

JENIS: ISP_BARU
ISP: Telkom Indonesia (Persero) Tbk
AWAL_KONTRAK: 01-Jan-24
PERIODE_MULAI: 01-Jan-24
PERIODE_AKHIR: 31-Dec-24
NOMOR_KONTRAK: KIMA.PERU-013/DOP/III/2024 dan K.TEL.683/HK.810/DR7-10000000/2024
AKSI: Buat ISP baru

Ini lokasi di bawah ISP tersebut.

JENIS: LOKASI_BARU
ISP: Telkom Indonesia (Persero) Tbk
LOKASI: 48 ODP
PAKET: CORE
JUMLAH_CORE: 48
AWAL_KONTRAK: 01-Jan-24
PERIODE_MULAI: 01-Jan-24
PERIODE_AKHIR: 31-Dec-24
NOMOR_KONTRAK: KIMA.PERU-013/DOP/III/2024 dan K.TEL.683/HK.810/DR7-10000000/2024
NOMINAL_BULANAN: 69600000
NOMINAL_TAHUNAN: 835200000
BIAYA_AKTIVASI: 0
AKSI: Buat lokasi baru di bawah ISP Telkom
```

---

## Checklist Sebelum Mengirim Data ke AI

- [ ] Sudah jelas mana `ISP` dan mana `LOKASI`
- [ ] Sudah jelas ini `baru`, `perpanjangan`, `update`, atau `verifikasi`
- [ ] Tanggal sudah absolut
- [ ] Nominal sudah angka polos
- [ ] Paket sudah jelas: `CORE` atau `SHARING CORE`
- [ ] Jika `CORE`, jumlah core sudah ada
- [ ] Jika `SHARING CORE`, rasio sudah ada
- [ ] Jika minta upload, sudah jelas dokumen apa yang harus diupload
- [ ] Jika minta ubah status, sudah jelas target statusnya
- [ ] Jika ada data multi-periode, tiap periode dipisah blok

---

## Ringkasan Singkat untuk Pemakaian Harian

Kalau ingin cepat, kirim data minimal seperti ini:

```text
Ini ISP, bukan lokasi.
JENIS: ISP_BARU
ISP: ...
PERIODE_MULAI: ...
PERIODE_AKHIR: ...
NOMOR_KONTRAK: ...
AKSI: Buat ISP baru

Ini lokasi di bawah ISP tersebut.
JENIS: LOKASI_BARU
ISP: ...
LOKASI: ...
PAKET: CORE / SHARING CORE
JUMLAH_CORE: ...
RASIO_SHARING: ...
PERIODE_MULAI: ...
PERIODE_AKHIR: ...
NOMOR_KONTRAK: ...
NOMINAL_BULANAN: ...
NOMINAL_TAHUNAN: ...
BIAYA_AKTIVASI: ...
AKSI: Buat lokasi baru
```

Jika format ini dipakai, kemungkinan salah tafsir akan jauh lebih kecil.
