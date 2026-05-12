# Panduan Insert Data ke Production (Supabase)

**Tanggal:** 2026-05-12  
**Target:** Supabase PostgreSQL (Production)

---

## 📋 Daftar Script

1. **`migration-add-notes-and-amounts-production.sql`**  
   Migration untuk menambahkan field baru (notes, monthly_amount, yearly_amount, remarks)

2. **`insert-charoen-pokphand-production.sql`**  
   Insert data PT Charoen Pokphand Indonesia dengan 3 versi kontrak (2024-2026)

---

## 🚀 Langkah-Langkah Eksekusi

### **STEP 1: Login ke Supabase Dashboard**

1. Buka https://supabase.com
2. Login dengan akun Anda
3. Pilih project: **sistem-fo-kima** (atau nama project Anda)
4. Klik menu **SQL Editor** di sidebar kiri

---

### **STEP 2: Jalankan Migration (Field Baru)**

**⚠️ PENTING: Jalankan ini DULU sebelum insert data!**

1. Di SQL Editor, klik **New Query**
2. Copy seluruh isi file: `migration-add-notes-and-amounts-production.sql`
3. Paste ke SQL Editor
4. Klik tombol **Run** (atau tekan Ctrl+Enter)
5. Tunggu sampai muncul pesan sukses

**Expected Output:**
```
BEGIN
ALTER TABLE
ALTER TABLE
COMMIT
```

**Jika ada error:**
- Error "column already exists" → **AMAN**, field sudah ada, lanjut ke step berikutnya
- Error lain → Screenshot dan tanyakan ke developer

---

### **STEP 3: Verifikasi Migration (Opsional)**

Uncomment dan jalankan query verifikasi di bagian bawah script migration:

```sql
-- Cek struktur tabel customers
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'customers'
  AND column_name IN ('notes')
ORDER BY ordinal_position;

-- Cek struktur tabel contract_versions
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'contract_versions'
  AND column_name IN ('monthly_amount', 'yearly_amount', 'remarks')
ORDER BY ordinal_position;
```

**Expected Output:**
Harus muncul 4 kolom baru:
- `notes` (TEXT)
- `monthly_amount` (DECIMAL)
- `yearly_amount` (DECIMAL)
- `remarks` (TEXT)

---

### **STEP 4: Cek ISP PT Cendikia Global Solusi**

Sebelum insert data, pastikan ISP sudah ada:

```sql
SELECT id, name, status
FROM isps
WHERE name = 'PT Cendikia Global Solusi';
```

**Expected Output:**
```
id | name                          | status
---+-------------------------------+--------
1  | PT Cendikia Global Solusi     | aktif
```

**Jika ISP tidak ada:**
- Hubungi admin untuk insert ISP dulu
- Atau insert manual via UI/API

---

### **STEP 5: Insert Data PT Charoen Pokphand Indonesia**

1. Di SQL Editor, klik **New Query** (tab baru)
2. Copy seluruh isi file: `insert-charoen-pokphand-production.sql`
3. Paste ke SQL Editor
4. Klik tombol **Run** (atau tekan Ctrl+Enter)
5. Tunggu sampai selesai (bisa 5-10 detik)

**Expected Output:**
```
BEGIN
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 12
INSERT 0 1
INSERT 0 12
INSERT 0 1
INSERT 0 12
COMMIT
```

**Total Records Inserted:**
- 1 Customer
- 1 Customer-ISP Membership
- 1 Contract
- 3 Contract Versions
- 36 Invoices (12 per tahun)

---

### **STEP 6: Verifikasi Data (Wajib)**

Jalankan query verifikasi di bagian bawah script insert:

```sql
-- 1. Cek customer
SELECT id, customer_code, name, status, activation_fee_amount
FROM customers
WHERE customer_code = 'CUST-CPI-001';
```

**Expected Output:**
```
id | customer_code | name                              | status | activation_fee_amount
---+---------------+-----------------------------------+--------+----------------------
9  | CUST-CPI-001  | PT Charoen Pokphand Indonesia     | aktif  | 2500000
```

```sql
-- 2. Cek contract versions
SELECT id, version_number, start_date, end_date, shared_core_ratio, monthly_amount, yearly_amount
FROM contract_versions
WHERE customer_id = (SELECT id FROM customers WHERE customer_code = 'CUST-CPI-001')
ORDER BY version_number;
```

**Expected Output:**
```
id | version_number | start_date  | end_date    | shared_core_ratio | monthly_amount | yearly_amount
---+----------------+-------------+-------------+-------------------+----------------+--------------
27 | 1              | 2024-01-01  | 2024-12-31  | 1/32              | 250000         | 3000000
28 | 2              | 2025-01-01  | 2025-12-31  | 1/32              | 250000         | 3000000
29 | 3              | 2026-01-01  | 2026-12-31  | 1/8               | 1000000        | 12000000
```

```sql
-- 3. Cek total invoices
SELECT period_year, COUNT(*) as total_invoices, SUM(amount) as total_amount
FROM invoices
WHERE customer_id = (SELECT id FROM customers WHERE customer_code = 'CUST-CPI-001')
GROUP BY period_year
ORDER BY period_year;
```

**Expected Output:**
```
period_year | total_invoices | total_amount
------------+----------------+-------------
2024        | 12             | 3000000
2025        | 12             | 3000000
2026        | 12             | 12000000
```

---

## ✅ Checklist Verifikasi

Setelah insert, pastikan semua ini benar:

- [ ] Customer PT Charoen Pokphand Indonesia ada dengan kode `CUST-CPI-001`
- [ ] Status customer: `aktif`
- [ ] Biaya aktivasi: Rp 2,500,000 (sudah dibayar)
- [ ] Ada 3 contract versions (2024, 2025, 2026)
- [ ] Version 1 & 2: sharing core `1/32`, Rp 250k/bulan
- [ ] Version 3: sharing core `1/8`, Rp 1jt/bulan (UPGRADE)
- [ ] Total 36 invoices (12 per tahun)
- [ ] Semua invoice status: `lunas`
- [ ] Total pembayaran 2024: Rp 3,000,000
- [ ] Total pembayaran 2025: Rp 3,000,000
- [ ] Total pembayaran 2026: Rp 12,000,000

---

## 🔧 Troubleshooting

### **Error: "duplicate key value violates unique constraint"**

**Penyebab:** Data sudah pernah di-insert sebelumnya

**Solusi:**
```sql
-- Hapus data lama dulu
DELETE FROM customers WHERE customer_code = 'CUST-CPI-001';

-- Lalu jalankan ulang script insert
```

---

### **Error: "column does not exist"**

**Penyebab:** Migration belum dijalankan

**Solusi:**
1. Jalankan `migration-add-notes-and-amounts-production.sql` dulu
2. Lalu jalankan ulang script insert

---

### **Error: "foreign key constraint"**

**Penyebab:** ISP "PT Cendikia Global Solusi" tidak ada

**Solusi:**
1. Cek ISP dengan query di STEP 4
2. Jika tidak ada, insert ISP dulu via UI atau API
3. Lalu jalankan ulang script insert

---

### **Error: "syntax error"**

**Penyebab:** Copy-paste tidak lengkap atau ada karakter rusak

**Solusi:**
1. Pastikan copy dari awal `BEGIN;` sampai akhir `COMMIT;`
2. Jangan copy dari preview/rendered markdown, copy dari file `.sql` langsung
3. Coba paste di text editor dulu untuk cek

---

## 📊 Cara Cek di Frontend

Setelah data berhasil di-insert, cek di frontend:

1. Login ke aplikasi
2. Buka menu **Pelanggan**
3. Cari "Charoen Pokphand"
4. Klik untuk lihat detail
5. Cek tab **Kontrak** → harus ada 3 versi
6. Cek tab **Invoice** → harus ada 36 invoice
7. Buka menu **Monitoring**
8. Filter tahun 2024, 2025, 2026
9. Cari baris "PT Charoen Pokphand Indonesia"
10. Semua bulan harus berwarna hijau (lunas)

---

## 📝 Notes Penting

1. **Urutan Eksekusi:**
   - Migration DULU → Insert Data KEMUDIAN
   - Jangan dibalik!

2. **Backup:**
   - Supabase otomatis backup setiap hari
   - Tapi lebih baik export data dulu sebelum insert besar

3. **Rollback:**
   - Jika ada masalah, hapus dengan:
     ```sql
     DELETE FROM customers WHERE customer_code = 'CUST-CPI-001';
     ```
   - Cascade delete akan otomatis hapus contract, versions, dan invoices

4. **Production Safety:**
   - Script ini sudah aman untuk production
   - Menggunakan `BEGIN...COMMIT` untuk transaction
   - Jika ada error, semua akan di-rollback otomatis

5. **ID Auto-increment:**
   - ID customer, contract, version, invoice akan auto-generate
   - Tidak perlu khawatir bentrok dengan data existing

---

## 🎯 Summary

**File yang perlu dijalankan (urutan):**
1. ✅ `migration-add-notes-and-amounts-production.sql` (sekali saja)
2. ✅ `insert-charoen-pokphand-production.sql` (untuk setiap pelanggan baru)

**Lokasi file:**
- `/scripts/migration-add-notes-and-amounts-production.sql`
- `/scripts/insert-charoen-pokphand-production.sql`

**Estimasi waktu:**
- Migration: ~5 detik
- Insert data: ~10 detik
- Total: ~15 detik

**Hasil akhir:**
- Database production akan memiliki data PT Charoen Pokphand Indonesia
- Lengkap dengan 3 tahun kontrak (2024-2026)
- Semua invoice sudah lunas
- Siap ditampilkan di monitoring spreadsheet

---

**Selamat mencoba! 🚀**

Jika ada pertanyaan atau error, screenshot dan tanyakan ke developer.
