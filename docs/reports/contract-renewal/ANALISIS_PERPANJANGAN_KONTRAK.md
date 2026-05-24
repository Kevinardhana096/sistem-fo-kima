# Analisis Sistem Perpanjangan Kontrak - Temuan Awal

**Tanggal:** 21 Mei 2026, 14:45 WIB  
**Status:** Analisis Parsial

---

## Temuan Utama

### 1. Status "Belum Diperpanjang"

**Lokasi:** `frontend/src/features/pelanggan/CustomerWorkspacePage.jsx:7-16`

**Logic:**
```javascript
const getTenantOperationalStatus = (tenant, todayIso) => {
    const rawStatus = normalizeOperationalStatus(tenant?.rawStatus);
    if (isStoppedStatus(rawStatus)) return "berhenti";
    if (rawStatus === "expired") return "expired";
    
    const contractEndDate = typeof tenant?.contractPeriodEnd === "string"
        ? tenant.contractPeriodEnd.slice(0, 10)
        : "";
    return contractEndDate && contractEndDate < todayIso ? "expired" : "beroperasi";
};
```

**Cara Kerja:**
- Status "expired" (ditampilkan sebagai "Belum Diperpanjang") muncul ketika `contractEndDate < todayIso`
- Ini berarti kontrak sudah melewati tanggal akhir periode berjalan
- ✅ **Test Case 4 TERKONFIRMASI:** Status otomatis berubah menjadi "Belum Diperpanjang" jika kontrak berakhir

**Tampilan UI:**
```javascript
// Baris 748
{getTenantOperationalStatus(tenant, todayIso) === "expired" 
  ? "Belum Diperpanjang" 
  : isTenantActive(tenant, todayIso) 
    ? "Beroperasi" 
    : "Berhenti"}
```

---

### 2. Sistem Renewal Follow-Ups

**Lokasi:** `frontend/src/features/pelanggan/TenantDetailPage.jsx`

**Fungsi Utama:**
1. `renderTenantRenewalFollowUps` (baris 2484-2547) - Render UI perpanjangan
2. `handleUploadTenantRenewal` (baris 2394-2422) - Upload surat perpanjangan
3. `handleAddTenantRenewalSplit` (baris 2387-2436) - Tambah split perpanjangan
4. `handleRespondTenantRenewal` (baris 2438-2482) - Tanggapan perpanjangan

**Tabel Database:**
- `contract_version_renewal_follow_ups` - Menyimpan data perpanjangan
- Fields: `renewal_file_url`, `response_file_url`, `split_order`, `source`

**UI Flow:**
1. Upload surat perpanjangan pertama kali
2. Sistem membuat record di `contract_version_renewal_follow_ups`
3. Menunggu tanggapan dari lokasi (Lanjut/Tidak)
4. Bisa split untuk peringatan kedua, ketiga, dst

---

### 3. Peringatan H-3, H-2, H-1 Bulan - BELUM DITEMUKAN

**Status:** ⚠️ Logic peringatan H-3, H-2, H-1 bulan BELUM ditemukan di frontend

**Kemungkinan Lokasi:**
1. **Backend/Supabase Function** - Logic mungkin di database trigger atau RPC function
2. **Todo System** - Mungkin dihitung di backend dan dikirim sebagai notification
3. **Cron Job** - Mungkin ada scheduled task yang menghitung peringatan
4. **Belum Diimplementasikan** - Fitur mungkin belum ada

**Yang Perlu Dicek:**
- [ ] Supabase RPC functions
- [ ] Database triggers
- [ ] Notification system di backend
- [ ] Todo summary calculation

---

## Kesimpulan Sementara

### ✅ Yang Sudah Dikonfirmasi

1. **Status "Belum Diperpanjang"** - Otomatis berubah ketika `contractEndDate < today`
2. **Sistem Upload Perpanjangan** - Ada UI untuk upload surat perpanjangan
3. **Sistem Tanggapan** - Ada UI untuk tanggapan (Lanjut/Tidak)
4. **Split Perpanjangan** - Bisa membuat multiple follow-ups

### ⚠️ Yang Belum Ditemukan

1. **Peringatan H-3 bulan** - Logic belum ditemukan
2. **Peringatan H-2 bulan** - Logic belum ditemukan
3. **Peringatan H-1 bulan** - Logic belum ditemukan
4. **Auto-trigger peringatan** - Mekanisme belum jelas

---

## Next Steps

1. Cek Supabase untuk RPC functions terkait renewal
2. Cek notification/todo system di backend
3. Test manual di browser untuk melihat apakah peringatan muncul
4. Jika belum ada, implementasikan logic peringatan H-3, H-2, H-1 bulan

---

**Dokumentasi:** Analisis akan dilanjutkan dengan testing manual di browser
