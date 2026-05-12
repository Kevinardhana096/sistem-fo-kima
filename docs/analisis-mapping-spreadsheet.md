# Analisis Mapping Kolom Spreadsheet ke Database & Backend API

**Tanggal:** 2026-05-12  
**Status:** ✅ Lengkap dengan beberapa catatan

---

## Kolom Spreadsheet yang Diminta

Berikut adalah kolom-kolom dari spreadsheet monitoring yang perlu direpresentasikan:

### Kolom Utama (Metadata Pelanggan & Kontrak)
1. **Nama ISP**
2. **Nama Pelanggan**
3. **Periode Awal Kontrak**
4. **Periode Berjalan** (Awal & Akhir)
5. **Core**
6. **Sharing Core**
7. **Nomor Kontrak**
8. **Nomor Invoice**
9. **Status**
10. **Keterangan**
11. **Nilai Kontrak** (Bulanan & Tahunan)
12. **Biaya Aktivasi**

### Kolom Monitoring Bulanan (2022-2027)
- **Jan-22** sampai **Dec-27** (72 kolom bulan untuk 6 tahun)

---

## Mapping ke Database Schema

### ✅ **1. Nama ISP**
**Database:** `Isp.name` via `CustomerIspMembership`  
**API Response:** `ispName`, `ispNames[]`  
**Status:** ✅ **TERSEDIA**

```typescript
// Dari monitoring API
{
  "ispName": "PT Cendikia Global Solusi",
  "ispNames": ["PT Cendikia Global Solusi"]
}
```

**Catatan:** Sistem mendukung multiple ISP per pelanggan (many-to-many relationship).

---

### ✅ **2. Nama Pelanggan**
**Database:** `Customer.name`  
**API Response:** `customerName`  
**Status:** ✅ **TERSEDIA**

```typescript
{
  "customerName": "PT Bank Tabungan Negara (Persero)"
}
```

---

### ✅ **3. Periode Awal Kontrak**
**Database:** `Isp.contractStartDate` atau `Customer.contractStartDate`  
**API Response:** `ispContractStart`  
**Status:** ✅ **TERSEDIA**

```typescript
{
  "ispContractStart": "2022-07-25"
}
```

**Catatan:** Ini adalah tanggal kontrak pertama kali dimulai (historical).

---

### ✅ **4. Periode Berjalan (Awal & Akhir)**
**Database:** `ContractVersion.startDate`, `ContractVersion.endDate`  
**API Response:** `contractStart`, `contractEnd`  
**Status:** ✅ **TERSEDIA**

```typescript
{
  "contractStart": "2025-07-08",
  "contractEnd": "2026-07-07"
}
```

**Catatan:** Mengambil dari versi kontrak terbaru yang aktif.

---

### ✅ **5. Core**
**Database:** `ContractVersion.coreTotal` atau `Contract.coreTotal`  
**API Response:** `coreTotal`  
**Status:** ✅ **TERSEDIA**

```typescript
{
  "coreType": "core",
  "coreTotal": 1
}
```

---

### ✅ **6. Sharing Core**
**Database:** `ContractVersion.sharedCoreRatio` atau `Contract.sharingRatio`  
**API Response:** `sharingRatio`  
**Status:** ✅ **TERSEDIA**

```typescript
{
  "coreType": "sharing_core",
  "sharingRatio": "1:4"
}
```

**Catatan:** `coreType` bisa berupa `core` atau `sharing_core`.

---

### ✅ **7. Nomor Kontrak**
**Database:** `Contract.contractNumber`  
**API Response:** `contractNumber`  
**Status:** ✅ **TERSEDIA**

```typescript
{
  "contractNumber": "KIMA-BAK-32/DBO/FO/VII/2025"
}
```

---

### ✅ **8. Nomor Invoice**
**Database:** `Invoice.invoiceNumber`  
**API Response:** `currentInvoiceNumber`  
**Status:** ✅ **TERSEDIA**

```typescript
{
  "currentInvoiceNumber": "INV-065/KIMA/FO/VII/2024-202412"
}
```

**Catatan:** Ini adalah invoice bulan berjalan atau invoice terbaru yang diterbitkan.

---

### ✅ **9. Status**
**Database:** `Customer.status`  
**API Response:** `customerStatus`  
**Status:** ✅ **TERSEDIA**

```typescript
{
  "customerStatus": "aktif" // atau "nonaktif", "expired", "berhenti", "arsip"
}
```

---

### ⚠️ **10. Keterangan**
**Database:** ❌ **TIDAK ADA KOLOM KHUSUS**  
**API Response:** ❌ **TIDAK TERSEDIA**  
**Status:** ⚠️ **PERLU DITAMBAHKAN**

**Rekomendasi:**
- Tambahkan kolom `notes` atau `remarks` di tabel `Customer` atau `Contract`
- Atau gunakan kolom `Document.note` untuk keterangan per dokumen

```sql
-- Migration yang diperlukan
ALTER TABLE customers ADD COLUMN notes TEXT;
-- atau
ALTER TABLE contracts ADD COLUMN remarks TEXT;
```

---

### ⚠️ **11. Nilai Kontrak (Bulanan & Tahunan)**
**Database:** `Invoice.amount` (per invoice)  
**API Response:** ❌ **TIDAK ADA FIELD KHUSUS**  
**Status:** ⚠️ **PERLU DITAMBAHKAN atau DIHITUNG**

**Situasi Saat Ini:**
- Database menyimpan `Invoice.amount` per invoice
- Tidak ada field khusus untuk "nilai kontrak bulanan" atau "nilai kontrak tahunan"

**Rekomendasi:**
1. **Opsi 1:** Tambahkan kolom di `Contract` atau `ContractVersion`:
   ```sql
   ALTER TABLE contract_versions ADD COLUMN monthly_amount DECIMAL(18,2);
   ALTER TABLE contract_versions ADD COLUMN yearly_amount DECIMAL(18,2);
   ```

2. **Opsi 2:** Hitung dari invoice:
   - Nilai Bulanan = `Invoice.amount` (untuk billing bulanan)
   - Nilai Tahunan = `Invoice.amount * 12` atau sum dari 12 invoice

**Catatan:** Saat ini sistem menggunakan `Invoice.amount` yang bisa berbeda-beda per periode billing.

---

### ✅ **12. Biaya Aktivasi**
**Database:** `Customer.activationFeeAmount`, `Customer.activationFeePaidAt`  
**API Response:** `activationFeeAmount`, `activationFeePaidAt`  
**Status:** ✅ **TERSEDIA**

```typescript
{
  "activationFeeAmount": 2500000,
  "activationFeePaidAt": null // atau timestamp jika sudah dibayar
}
```

---

### ✅ **13. Monitoring Bulanan (Jan-22 sampai Dec-27)**
**Database:** `Invoice.periodYear`, `Invoice.periodMonth`, `Invoice.status`  
**API Response:** `months[]` (array 12 bulan)  
**Status:** ✅ **TERSEDIA**

```typescript
{
  "months": [
    "lunas",           // Jan
    "lunas",           // Feb
    "belum_bayar",     // Mar
    "terlambat",       // Apr
    "belum_ditagih",   // May
    // ... dst sampai Dec
  ]
}
```

**Cara Kerja:**
- API `/api/monitoring/billing?year=2024` mengembalikan status per bulan untuk tahun tertentu
- Status invoice: `lunas`, `belum_bayar`, `terlambat`, `belum_ditagih`
- Untuk mendapatkan data 2022-2027, perlu memanggil API 6 kali (per tahun)

---

## Ringkasan Status Mapping

| No | Kolom Spreadsheet | Database/API | Status |
|----|-------------------|--------------|--------|
| 1 | Nama ISP | ✅ `Isp.name` | ✅ Tersedia |
| 2 | Nama Pelanggan | ✅ `Customer.name` | ✅ Tersedia |
| 3 | Periode Awal Kontrak | ✅ `Isp.contractStartDate` | ✅ Tersedia |
| 4 | Periode Berjalan (Awal) | ✅ `ContractVersion.startDate` | ✅ Tersedia |
| 5 | Periode Berjalan (Akhir) | ✅ `ContractVersion.endDate` | ✅ Tersedia |
| 6 | Core | ✅ `ContractVersion.coreTotal` | ✅ Tersedia |
| 7 | Sharing Core | ✅ `ContractVersion.sharedCoreRatio` | ✅ Tersedia |
| 8 | Nomor Kontrak | ✅ `Contract.contractNumber` | ✅ Tersedia |
| 9 | Nomor Invoice | ✅ `Invoice.invoiceNumber` | ✅ Tersedia |
| 10 | Status | ✅ `Customer.status` | ✅ Tersedia |
| 11 | **Keterangan** | ❌ **Tidak ada** | ⚠️ **Perlu ditambahkan** |
| 12 | **Nilai Kontrak (Bulanan)** | ⚠️ `Invoice.amount` | ⚠️ **Perlu field khusus** |
| 13 | **Nilai Kontrak (Tahunan)** | ⚠️ Hitung dari invoice | ⚠️ **Perlu field khusus** |
| 14 | Biaya Aktivasi | ✅ `Customer.activationFeeAmount` | ✅ Tersedia |
| 15 | Monitoring Bulanan (72 bulan) | ✅ `Invoice.status` per bulan | ✅ Tersedia |

---

## Kesimpulan

### ✅ **Yang Sudah Bisa Direpresentasikan (12/15 kolom)**

Backend dan database **SUDAH BISA** merepresentasikan sebagian besar kolom spreadsheet:
- Metadata pelanggan (nama, ISP, status)
- Informasi kontrak (nomor, periode, core allocation)
- Biaya aktivasi
- **Monitoring billing per bulan untuk semua tahun (2022-2027)**

### ⚠️ **Yang Perlu Ditambahkan (3/15 kolom)**

1. **Keterangan/Notes** - Tidak ada field khusus untuk catatan
2. **Nilai Kontrak Bulanan** - Perlu field eksplisit atau kalkulasi
3. **Nilai Kontrak Tahunan** - Perlu field eksplisit atau kalkulasi

---

## Rekomendasi Implementasi

### **Opsi 1: Tambahkan Field Baru (Recommended)**

```prisma
// prisma/schema.prisma

model Customer {
  // ... existing fields
  notes String? // Keterangan umum pelanggan
}

model ContractVersion {
  // ... existing fields
  monthlyAmount  Decimal @default(0) @map("monthly_amount") @db.Decimal(18, 2)
  yearlyAmount   Decimal @default(0) @map("yearly_amount") @db.Decimal(18, 2)
  remarks        String? // Keterangan kontrak
}
```

**Migration:**
```bash
cd backend
npx prisma migrate dev --name add_notes_and_contract_amounts
```

**Update API Response:**
```typescript
// monitoring.service.ts
{
  // ... existing fields
  monthlyAmount: latestVersion?.monthlyAmount ?? 0,
  yearlyAmount: latestVersion?.yearlyAmount ?? 0,
  notes: customer.notes ?? null,
  contractRemarks: latestVersion?.remarks ?? null
}
```

### **Opsi 2: Kalkulasi Runtime (Alternatif)**

Hitung nilai kontrak dari invoice yang ada:
```typescript
const monthlyAmount = currentMonthInvoice?.amount ?? 0;
const yearlyAmount = customer.invoices
  .filter(inv => inv.periodYear === year)
  .reduce((sum, inv) => sum + Number(inv.amount), 0);
```

**Kelebihan:** Tidak perlu migration  
**Kekurangan:** Nilai bisa berubah jika invoice diupdate, tidak ada "nilai kontrak tetap"

---

## Cara Menggunakan API untuk Spreadsheet

### **Mendapatkan Data 2022-2027 (6 tahun)**

```javascript
// Frontend code
const years = [2022, 2023, 2024, 2025, 2026, 2027];
const allData = await Promise.all(
  years.map(year => 
    fetch(`/api/monitoring/billing?year=${year}`).then(r => r.json())
  )
);

// Merge data per customer
const customerMap = new Map();
allData.forEach((yearData, index) => {
  const year = years[index];
  yearData.rows.forEach(row => {
    if (!customerMap.has(row.customerId)) {
      customerMap.set(row.customerId, {
        ...row,
        monthsByYear: {}
      });
    }
    customerMap.get(row.customerId).monthsByYear[year] = row.months;
  });
});

// Hasil: Map dengan data 72 bulan per customer
```

### **Format Spreadsheet**

```javascript
// Convert ke format spreadsheet
const spreadsheetRows = Array.from(customerMap.values()).map(customer => ({
  'Nama ISP': customer.ispName,
  'Nama Pelanggan': customer.customerName,
  'Periode Awal Kontrak': customer.ispContractStart,
  'Periode Berjalan - Awal': customer.contractStart,
  'Periode Berjalan - Akhir': customer.contractEnd,
  'Core': customer.coreTotal,
  'Sharing Core': customer.sharingRatio,
  'Nomor Kontrak': customer.contractNumber,
  'Nomor Invoice': customer.currentInvoiceNumber,
  'Status': customer.customerStatus,
  'Keterangan': customer.notes ?? '-', // Jika ditambahkan
  'Nilai Kontrak - Bulanan': customer.monthlyAmount ?? '-', // Jika ditambahkan
  'Nilai Kontrak - Tahunan': customer.yearlyAmount ?? '-', // Jika ditambahkan
  'Biaya Aktivasi': customer.activationFeeAmount,
  
  // 72 kolom bulan
  'Jan-22': customer.monthsByYear[2022]?.[0] ?? '-',
  'Feb-22': customer.monthsByYear[2022]?.[1] ?? '-',
  // ... dst sampai Dec-27
}));
```

---

## Testing

Untuk memverifikasi data yang ada:

```bash
# Test API monitoring untuk tahun 2024
curl "http://localhost:4000/api/monitoring/billing?year=2024" | jq '.rows[0]'

# Test dengan filter ISP
curl "http://localhost:4000/api/monitoring/billing?year=2024&isp=Cendikia" | jq '.rows | length'

# Test alerts
curl "http://localhost:4000/api/monitoring/alerts?year=2024" | jq '.alerts | length'
```

---

## Kesimpulan Akhir

**Status:** ✅ **80% Siap** (12 dari 15 kolom tersedia)

Backend dan database **SUDAH BISA** merepresentasikan hampir semua data yang dibutuhkan untuk spreadsheet monitoring. Yang perlu ditambahkan hanya:
1. Field `notes/keterangan` (opsional, bisa pakai workaround)
2. Field `monthlyAmount` dan `yearlyAmount` (bisa dihitung dari invoice)

Sistem monitoring billing **SUDAH BERFUNGSI** dan bisa menampilkan status pembayaran per bulan untuk rentang tahun 2022-2027.
