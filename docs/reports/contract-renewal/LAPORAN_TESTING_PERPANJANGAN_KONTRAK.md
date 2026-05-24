# Laporan Testing: Sistem Perpanjangan Kontrak

**Tanggal Testing:** 21 Mei 2026, 14:48 WIB  
**Tester:** Claude (AI Assistant)  
**Status:** ⚠️ PARSIAL - Fitur Belum Sepenuhnya Diimplementasikan

---

## Ringkasan Eksekutif

Setelah melakukan analisis kode mendalam dan testing manual, saya menemukan bahwa **sistem perpanjangan kontrak belum sepenuhnya diimplementasikan sesuai test case**. Berikut adalah temuan detail:

---

## Test Case vs Implementasi Aktual

### ✅ Test Case 4: Status "Belum Diperpanjang" - LULUS

**Requirement:**
> Jika hingga masa kontrak berakhir belum ada tanggapan, maka status kontrak pada monitoring akan berubah menjadi Belum Diperpanjang.

**Hasil Testing:**
- ✅ **LULUS** - Status otomatis berubah menjadi "Belum Diperpanjang"
- Logic ada di `CustomerWorkspacePage.jsx:7-16`
- Status berubah ketika `contractEndDate < todayIso`

**Kode:**
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

// UI Display (baris 748)
{getTenantOperationalStatus(tenant, todayIso) === "expired" 
  ? "Belum Diperpanjang" 
  : isTenantActive(tenant, todayIso) 
    ? "Beroperasi" 
    : "Berhenti"}
```

---

### ❌ Test Case 1: Peringatan H-3 Bulan - TIDAK DITEMUKAN

**Requirement:**
> H-3 bulan sebelum masa kontrak berakhir (berdasarkan periode berjalan akhir), akan muncul peringatan untuk segera membuat surat perpanjangan.

**Hasil Testing:**
- ❌ **TIDAK DITEMUKAN** - Logic peringatan H-3 bulan tidak ada di kode
- Tidak ada perhitungan tanggal H-3 bulan
- Tidak ada notifikasi otomatis yang muncul

**Yang Ada:**
- Sistem upload surat perpanjangan manual
- UI untuk upload di kolom "Perpanjangan" di tabel kontrak
- Tapi tidak ada peringatan otomatis H-3 bulan

---

### ❌ Test Case 2: Peringatan H-2 Bulan - TIDAK DITEMUKAN

**Requirement:**
> Jika surat perpanjangan sudah di-upload dan masih menunggu tanggapan dari lokasi, maka pada H-2 bulan sebelum masa berakhir akan muncul peringatan kedua untuk perpanjangan.

**Hasil Testing:**
- ❌ **TIDAK DITEMUKAN** - Logic peringatan H-2 bulan tidak ada
- Sistem split perpanjangan ada (bisa buat peringatan kedua manual)
- Tapi tidak ada trigger otomatis H-2 bulan

**Yang Ada:**
- Fungsi `handleAddTenantRenewalSplit` untuk split manual
- Button "Split" untuk tambah peringatan kedua
- Tapi harus dilakukan manual, bukan otomatis H-2 bulan

---

### ❌ Test Case 3: Peringatan H-1 Bulan - TIDAK DITEMUKAN

**Requirement:**
> Jika masih belum ada tanggapan, maka pada H-1 bulan sebelum masa berakhir akan muncul peringatan ketiga untuk perpanjangan.

**Hasil Testing:**
- ❌ **TIDAK DITEMUKAN** - Logic peringatan H-1 bulan tidak ada
- Sama seperti H-2, harus split manual
- Tidak ada trigger otomatis H-1 bulan

---

## Infrastruktur yang Sudah Ada

### 1. Tabel Database

**`contract_version_renewal_follow_ups`**
```sql
- id (primary key)
- contract_id (foreign key)
- contract_version_id (foreign key)
- customer_id (foreign key)
- split_order (1, 2, 3, ...)
- source (auto / manual / upload)
- renewal_file_url (surat perpanjangan)
- response_file_url (tanggapan lokasi)
- response_decision (lanjut / tidak)
- created_at
- updated_at
```

### 2. Fungsi Frontend

**Upload Perpanjangan:**
```javascript
// TenantDetailPage.jsx:2394-2422
const handleUploadTenantRenewal = async (row, file, followUpId = null)
```

**Split Perpanjangan:**
```javascript
// TenantDetailPage.jsx:2387-2436
const handleAddTenantRenewalSplit = async (row)
```

**Tanggapan Perpanjangan:**
```javascript
// TenantDetailPage.jsx:2438-2482
const handleRespondTenantRenewal = async (row, decision, file, followUpId)
```

**Render UI:**
```javascript
// TenantDetailPage.jsx:2484-2547
const renderTenantRenewalFollowUps = (row, columnType)
```

### 3. UI Flow yang Ada

```
1. User upload surat perpanjangan pertama
   ↓
2. Record dibuat di contract_version_renewal_follow_ups
   ↓
3. Menunggu tanggapan dari lokasi
   ↓
4. Lokasi upload tanggapan (Lanjut/Tidak)
   ↓
5. User bisa split manual untuk peringatan kedua/ketiga
```

---

## Yang Belum Diimplementasikan

### 1. Perhitungan Tanggal H-3, H-2, H-1 Bulan

**Yang Dibutuhkan:**
```javascript
// Contoh logic yang perlu ditambahkan
const getContractRenewalWarnings = (contractEndDate, todayIso) => {
  const endDate = new Date(contractEndDate);
  const today = new Date(todayIso);
  
  // H-3 bulan = 90 hari sebelum berakhir
  const h3Date = new Date(endDate);
  h3Date.setDate(h3Date.getDate() - 90);
  
  // H-2 bulan = 60 hari sebelum berakhir
  const h2Date = new Date(endDate);
  h2Date.setDate(h2Date.getDate() - 60);
  
  // H-1 bulan = 30 hari sebelum berakhir
  const h1Date = new Date(endDate);
  h1Date.setDate(h1Date.getDate() - 30);
  
  if (today >= h3Date && today < h2Date) return "h3_warning";
  if (today >= h2Date && today < h1Date) return "h2_warning";
  if (today >= h1Date && today < endDate) return "h1_warning";
  
  return null;
};
```

### 2. Notifikasi/Todo Otomatis

**Yang Dibutuhkan:**
- Sistem notifikasi yang muncul di "Kelengkapan Berkas" atau "Tindakan Kritis"
- Peringatan muncul otomatis berdasarkan tanggal
- Berbeda untuk H-3, H-2, H-1 bulan

**Contoh Notifikasi:**
```javascript
// H-3 bulan
{
  code: "renewal_h3_warning",
  title: "Kontrak akan berakhir dalam 3 bulan",
  message: "Segera buat dan upload surat perpanjangan kontrak.",
  dueDate: contractEndDate
}

// H-2 bulan (jika sudah upload tapi belum ada tanggapan)
{
  code: "renewal_h2_warning",
  title: "Kontrak akan berakhir dalam 2 bulan",
  message: "Surat perpanjangan sudah diupload. Menunggu tanggapan dari lokasi.",
  dueDate: contractEndDate
}

// H-1 bulan (jika masih belum ada tanggapan)
{
  code: "renewal_h1_warning",
  title: "Kontrak akan berakhir dalam 1 bulan",
  message: "Belum ada tanggapan perpanjangan. Segera follow up dengan lokasi.",
  dueDate: contractEndDate
}
```

### 3. Auto-Split Perpanjangan

**Yang Dibutuhkan:**
- Otomatis membuat split kedua di H-2 bulan
- Otomatis membuat split ketiga di H-1 bulan
- Atau minimal notifikasi untuk user membuat split

---

## Rekomendasi Implementasi

### Prioritas Tinggi

#### 1. Tambahkan Logic Perhitungan H-3, H-2, H-1 Bulan

**Lokasi:** `frontend/src/features/pelanggan/TenantDetailPage.jsx`

**Implementasi:**
```javascript
// Tambahkan di bagian useMemo atau useEffect
const contractRenewalWarning = useMemo(() => {
  if (!contract?.endDate) return null;
  
  const endDate = new Date(contract.endDate);
  const today = new Date(todayIso);
  const daysUntilEnd = Math.floor((endDate - today) / (1000 * 60 * 60 * 24));
  
  // H-3 bulan = 90 hari
  if (daysUntilEnd <= 90 && daysUntilEnd > 60) {
    return {
      level: "h3",
      daysLeft: daysUntilEnd,
      message: `Kontrak akan berakhir dalam ${daysUntilEnd} hari (H-3 bulan). Segera upload surat perpanjangan.`
    };
  }
  
  // H-2 bulan = 60 hari
  if (daysUntilEnd <= 60 && daysUntilEnd > 30) {
    const hasRenewalUpload = contractRowsForTable[0]?.renewalFollowUps?.length > 0;
    const hasResponse = contractRowsForTable[0]?.renewalFollowUps?.some(
      f => f.responseFileUrl
    );
    
    if (hasRenewalUpload && !hasResponse) {
      return {
        level: "h2",
        daysLeft: daysUntilEnd,
        message: `Kontrak akan berakhir dalam ${daysUntilEnd} hari (H-2 bulan). Surat perpanjangan sudah diupload, menunggu tanggapan lokasi.`
      };
    }
  }
  
  // H-1 bulan = 30 hari
  if (daysUntilEnd <= 30 && daysUntilEnd > 0) {
    const hasResponse = contractRowsForTable[0]?.renewalFollowUps?.some(
      f => f.responseFileUrl
    );
    
    if (!hasResponse) {
      return {
        level: "h1",
        daysLeft: daysUntilEnd,
        message: `Kontrak akan berakhir dalam ${daysUntilEnd} hari (H-1 bulan). Belum ada tanggapan perpanjangan!`
      };
    }
  }
  
  return null;
}, [contract, contractRowsForTable, todayIso]);
```

#### 2. Tambahkan Notifikasi di derivedNeedActionTodos

**Lokasi:** `frontend/src/features/pelanggan/TenantDetailPage.jsx:1121`

**Implementasi:**
```javascript
// Tambahkan setelah notifikasi BAK
if (contractRenewalWarning) {
  derivedNeedActionTodos.push({
    id: `derived-renewal-warning-${contractRenewalWarning.level}-${customer.id}`,
    code: `renewal_${contractRenewalWarning.level}_warning`,
    title: `Peringatan Perpanjangan Kontrak (${contractRenewalWarning.level.toUpperCase()})`,
    message: contractRenewalWarning.message,
    dueDate: contract.endDate,
  });
}
```

#### 3. Tambahkan Banner Peringatan di Tab Kontrak

**Lokasi:** Setelah banner sukses di tab Kontrak

**Implementasi:**
```jsx
{contractRenewalWarning && (
  <div className={`mb-8 p-4 rounded-2xl border backdrop-blur-md ${
    contractRenewalWarning.level === "h1" 
      ? "bg-red-500/10 border-red-500/20 text-red-400"
      : contractRenewalWarning.level === "h2"
        ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
        : "bg-blue-500/10 border-blue-500/20 text-blue-400"
  } text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-in fade-in zoom-in-95`}>
    <span className="material-symbols-outlined text-lg">schedule</span>
    {contractRenewalWarning.message}
  </div>
)}
```

### Prioritas Menengah

#### 4. Auto-Split Perpanjangan (Opsional)

Otomatis membuat split kedua dan ketiga ketika mencapai H-2 dan H-1 bulan.

**Implementasi:**
- Bisa menggunakan Supabase Edge Function
- Atau cron job yang berjalan setiap hari
- Atau trigger di frontend ketika user membuka detail customer

#### 5. Email/WhatsApp Notification (Opsional)

Kirim notifikasi ke admin/finance ketika mencapai H-3, H-2, H-1 bulan.

---

## Kesimpulan

### Status Test Case

| Test Case | Status | Keterangan |
|-----------|--------|------------|
| H-3 bulan peringatan | ❌ GAGAL | Logic belum diimplementasikan |
| H-2 bulan peringatan | ❌ GAGAL | Logic belum diimplementasikan |
| H-1 bulan peringatan | ❌ GAGAL | Logic belum diimplementasikan |
| Status Belum Diperpanjang | ✅ LULUS | Otomatis berubah ketika kontrak berakhir |

### Infrastruktur

- ✅ Database schema sudah siap
- ✅ UI upload/tanggapan sudah ada
- ✅ Sistem split manual sudah ada
- ❌ Logic peringatan otomatis belum ada
- ❌ Notifikasi H-3, H-2, H-1 belum ada

### Rekomendasi

**Untuk Development Team:**
1. Implementasikan logic perhitungan H-3, H-2, H-1 bulan (Prioritas Tinggi)
2. Tambahkan notifikasi di todo system (Prioritas Tinggi)
3. Tambahkan banner peringatan di UI (Prioritas Tinggi)
4. Pertimbangkan auto-split perpanjangan (Prioritas Menengah)
5. Pertimbangkan email/WhatsApp notification (Prioritas Menengah)

**Estimasi Waktu:**
- Implementasi Prioritas Tinggi: 4-6 jam development
- Testing: 2-3 jam
- Total: 1 hari kerja

---

**Dokumentasi dibuat:** 21 Mei 2026, 14:48 WIB  
**Status:** ⚠️ Fitur perpanjangan kontrak belum sepenuhnya sesuai test case  
**Next Steps:** Implementasi logic peringatan H-3, H-2, H-1 bulan
