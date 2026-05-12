# Field Baru untuk Monitoring Spreadsheet

**Tanggal:** 2026-05-12  
**Status:** ✅ Implemented

---

## Field yang Ditambahkan

### 1. **Customer Notes** (`customers.notes`)
**Tipe:** `TEXT` (nullable)  
**Deskripsi:** Keterangan umum tentang pelanggan  
**API Response:** `notes`

**Contoh Penggunaan:**
```sql
UPDATE customers 
SET notes = 'Pelanggan prioritas, pembayaran selalu tepat waktu'
WHERE id = 7;
```

---

### 2. **Monthly Amount** (`contract_versions.monthly_amount`)
**Tipe:** `DECIMAL(18,2)` (default: 0)  
**Deskripsi:** Nilai kontrak bulanan yang disepakati  
**API Response:** `monthlyAmount`

**Contoh Penggunaan:**
```sql
UPDATE contract_versions 
SET monthly_amount = 5000000.00
WHERE id = 1;
```

---

### 3. **Yearly Amount** (`contract_versions.yearly_amount`)
**Tipe:** `DECIMAL(18,2)` (default: 0)  
**Deskripsi:** Nilai kontrak tahunan yang disepakati  
**API Response:** `yearlyAmount`

**Contoh Penggunaan:**
```sql
UPDATE contract_versions 
SET yearly_amount = 60000000.00
WHERE id = 1;
```

**Catatan:** Biasanya `yearly_amount = monthly_amount * 12`, tapi bisa berbeda jika ada diskon tahunan.

---

### 4. **Contract Remarks** (`contract_versions.remarks`)
**Tipe:** `TEXT` (nullable)  
**Deskripsi:** Keterangan khusus tentang versi kontrak tertentu  
**API Response:** `contractRemarks`

**Contoh Penggunaan:**
```sql
UPDATE contract_versions 
SET remarks = 'Perpanjangan dengan diskon 10% untuk tahun pertama'
WHERE id = 1;
```

---

## API Response

### Endpoint: `GET /api/monitoring/billing?year=2024`

**Response Structure:**
```json
{
  "year": 2024,
  "appliedFilters": {
    "isp": null,
    "status": null
  },
  "summary": {
    "lunas": 24,
    "belum_bayar": 0,
    "terlambat": 0,
    "belum_ditagih": 0
  },
  "rows": [
    {
      "customerId": 7,
      "customerCode": "CUST-BTN-001",
      "ispName": "PT Cendikia Global Solusi",
      "customerName": "PT Bank Tabungan Negara (Persero)",
      "contractNumber": "KIMA-BAK-32/DBO/FO/VII/2025",
      "currentInvoiceNumber": "INV-065/KIMA/FO/VII/2024-202412",
      "contractStart": "2025-07-08",
      "contractEnd": "2026-07-07",
      "coreType": "core",
      "coreTotal": 1,
      "sharingRatio": null,
      
      // ✅ Field Baru
      "monthlyAmount": 5000000,
      "yearlyAmount": 60000000,
      "notes": "Pelanggan prioritas",
      "contractRemarks": "Perpanjangan dengan diskon 10%",
      
      "activationFeeAmount": 2500000,
      "months": ["lunas", "lunas", "lunas", ...]
    }
  ]
}
```

---

## Cara Mengisi Data

### Via SQL (Direct Database)

```sql
-- Update customer notes
UPDATE customers 
SET notes = 'Keterangan pelanggan'
WHERE customer_code = 'CUST-BTN-001';

-- Update contract amounts dan remarks
UPDATE contract_versions 
SET 
  monthly_amount = 5000000.00,
  yearly_amount = 60000000.00,
  remarks = 'Keterangan kontrak'
WHERE contract_id = (
  SELECT id FROM contracts WHERE contract_number = 'KIMA-BAK-32/DBO/FO/VII/2025'
)
AND version_number = (
  SELECT MAX(version_number) 
  FROM contract_versions cv2 
  WHERE cv2.contract_id = contract_versions.contract_id
);
```

### Via API (Jika endpoint sudah dibuat)

```javascript
// Update customer
PATCH /api/customers/:id
{
  "notes": "Pelanggan prioritas, pembayaran selalu tepat waktu"
}

// Update contract version
PATCH /api/customers/:customerId/contracts/:contractId/versions/:versionId
{
  "monthlyAmount": 5000000,
  "yearlyAmount": 60000000,
  "remarks": "Perpanjangan dengan diskon 10% untuk tahun pertama"
}
```

---

## Mapping ke Spreadsheet

| Kolom Spreadsheet | Database Field | API Response Field |
|-------------------|----------------|-------------------|
| Keterangan | `customers.notes` | `notes` |
| Nilai Kontrak - Bulanan | `contract_versions.monthly_amount` | `monthlyAmount` |
| Nilai Kontrak - Tahunan | `contract_versions.yearly_amount` | `yearlyAmount` |
| Keterangan Kontrak | `contract_versions.remarks` | `contractRemarks` |

---

## Migration Info

**Migration Name:** `20260512152019_add_notes_and_contract_amounts`

**SQL:**
```sql
-- AlterTable
ALTER TABLE "contract_versions" 
ADD COLUMN "monthly_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN "remarks" TEXT,
ADD COLUMN "yearly_amount" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "customers" 
ADD COLUMN "notes" TEXT;
```

**Status:** ✅ Applied to local database

---

## Testing

```bash
# Test API dengan field baru
curl "http://localhost:4000/api/monitoring/billing?year=2024" | jq '.rows[0] | {
  customerName,
  monthlyAmount,
  yearlyAmount,
  notes,
  contractRemarks
}'

# Expected output:
# {
#   "customerName": "PT Bank Tabungan Negara (Persero)",
#   "monthlyAmount": 0,
#   "yearlyAmount": 0,
#   "notes": null,
#   "contractRemarks": null
# }
```

---

## Next Steps

1. ✅ Database schema updated
2. ✅ Migration applied
3. ✅ API response updated
4. ✅ TypeScript types updated
5. ⏳ Frontend UI untuk input field baru (belum dibuat)
6. ⏳ Validation rules untuk amount fields (opsional)

---

## Notes

- Field `monthlyAmount` dan `yearlyAmount` default ke `0` jika tidak diisi
- Field `notes` dan `contractRemarks` nullable (bisa kosong)
- Data existing akan memiliki nilai default (0 untuk amount, null untuk text)
- Perlu update manual atau via API untuk mengisi data yang sudah ada
