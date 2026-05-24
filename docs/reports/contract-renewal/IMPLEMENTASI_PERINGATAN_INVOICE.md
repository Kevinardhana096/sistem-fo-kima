# Implementasi Peringatan Invoice untuk Perubahan Kontrak

**Tanggal Implementasi:** 2026-05-21  
**Developer:** Claude  
**Status:** ✅ Selesai Diimplementasikan

---

## Ringkasan

Menambahkan peringatan eksplisit ketika terjadi perubahan kontrak (ganti paket) di tengah periode berjalan dan terdapat invoice yang belum dibayar. Peringatan ini membantu user untuk mengetahui bahwa perubahan kontrak mempengaruhi invoice yang ada dan perlu dilakukan update.

---

## Perubahan Kode

### File yang Dimodifikasi

**File:** `frontend/src/features/pelanggan/TenantDetailPage.jsx`  
**Fungsi:** `handleCreateVersion` (baris 1502-1542)

### Kode Sebelum Perubahan

```javascript
await api.contractVersions.create({
  contract_id: contract.id,
  start_date: versionEditor.startDate,
  end_date: versionEditor.endDate,
  shared_core_ratio: versionEditor.ratio.trim(),
});
setVersionEditor(null);
setDocumentFeedback(
  "Riwayat perubahan kontrak berhasil dibuat. Upload BAK untuk mengaktifkan versi baru.",
);
await Promise.all([loadDetail(), onRefreshAll?.()]);
```

### Kode Setelah Perubahan

```javascript
await api.contractVersions.create({
  contract_id: contract.id,
  start_date: versionEditor.startDate,
  end_date: versionEditor.endDate,
  shared_core_ratio: versionEditor.ratio.trim(),
});
setVersionEditor(null);

// Check for unpaid invoices to warn about mid-contract changes
const unpaidInvoices = activeInvoices.filter(
  (invoice) => invoice.paymentStatus !== "paid"
);

if (unpaidInvoices.length > 0) {
  setDocumentFeedback(
    `Riwayat perubahan kontrak berhasil dibuat. Upload BAK untuk mengaktifkan versi baru. ⚠️ PERHATIAN: Terdapat ${unpaidInvoices.length} invoice yang belum dibayar. Silakan periksa dan update invoice jika diperlukan karena terjadi perubahan kontrak di tengah periode berjalan.`,
  );
} else {
  setDocumentFeedback(
    "Riwayat perubahan kontrak berhasil dibuat. Upload BAK untuk mengaktifkan versi baru.",
  );
}

await Promise.all([loadDetail(), onRefreshAll?.()]);
```

---

## Cara Kerja

### 1. Deteksi Invoice Belum Dibayar

Setelah berhasil membuat contract version baru, sistem akan:
1. Mengambil daftar `activeInvoices` (invoice yang tidak berstatus "history")
2. Filter invoice yang `paymentStatus !== "paid"` (belum dibayar)
3. Hitung jumlah invoice yang belum dibayar

### 2. Tampilkan Peringatan Kondisional

**Jika ada invoice belum dibayar:**
```
Riwayat perubahan kontrak berhasil dibuat. Upload BAK untuk mengaktifkan versi baru. 
⚠️ PERHATIAN: Terdapat X invoice yang belum dibayar. Silakan periksa dan update 
invoice jika diperlukan karena terjadi perubahan kontrak di tengah periode berjalan.
```

**Jika tidak ada invoice belum dibayar:**
```
Riwayat perubahan kontrak berhasil dibuat. Upload BAK untuk mengaktifkan versi baru.
```

### 3. Lokasi Tampilan Peringatan

Peringatan ditampilkan di:
- **Tab Kontrak** - Banner hijau di bawah tombol "Tambah Kontrak Baru"
- **Format:** Success feedback dengan icon `verified`
- **Warna:** Hijau emerald dengan background blur
- **Durasi:** Tetap tampil sampai user refresh atau pindah halaman

---

## Skenario Penggunaan

### Skenario 1: Customer Tanpa Invoice Aktif

**Kondisi:**
- Customer baru dibuat
- Belum ada invoice yang di-generate
- User melakukan perubahan kontrak (ganti paket)

**Hasil:**
```
✅ Riwayat perubahan kontrak berhasil dibuat. Upload BAK untuk mengaktifkan versi baru.
```

### Skenario 2: Customer dengan Invoice Belum Dibayar

**Kondisi:**
- Customer memiliki 2 invoice aktif
- Status pembayaran: "pending" atau "unpaid"
- User melakukan perubahan kontrak di tengah periode

**Hasil:**
```
✅ Riwayat perubahan kontrak berhasil dibuat. Upload BAK untuk mengaktifkan versi baru. 
⚠️ PERHATIAN: Terdapat 2 invoice yang belum dibayar. Silakan periksa dan update 
invoice jika diperlukan karena terjadi perubahan kontrak di tengah periode berjalan.
```

### Skenario 3: Customer dengan Semua Invoice Sudah Dibayar

**Kondisi:**
- Customer memiliki invoice aktif
- Semua invoice sudah berstatus "paid"
- User melakukan perubahan kontrak

**Hasil:**
```
✅ Riwayat perubahan kontrak berhasil dibuat. Upload BAK untuk mengaktifkan versi baru.
```

---

## Integrasi dengan Sistem Invoice

### Data Source

Peringatan menggunakan data dari:
- **`activeInvoices`** - Computed dari `detail.invoices` yang bukan "history"
- **`paymentStatus`** - Field di tabel `invoices` dengan nilai: "pending", "unpaid", "paid"

### Relasi dengan Fitur Lain

1. **Invoice Recalculation**
   - Fungsi `recalculateUnpaidInvoiceSchedule` (baris 1344-1402)
   - Otomatis recalculate invoice yang belum dibayar ketika periode billing berubah

2. **Invoice Workflow**
   - Fungsi `getInvoiceWorkflowMeta` (baris 689-832)
   - Menghitung metadata workflow invoice termasuk setup warnings

3. **Invoice Setup Warnings**
   - Fungsi `getInvoiceSetupWarnings` (baris 667-687)
   - Validasi kelengkapan data invoice (due date, amount)

---

## Testing

### Test Case 1: Tanpa Invoice ✅

**Steps:**
1. Buka customer yang baru dibuat (belum ada invoice)
2. Klik "Tambah Kontrak Baru"
3. Isi form dan submit

**Expected Result:**
- Pesan sukses standar tanpa peringatan invoice

**Actual Result:**
- ✅ Sesuai ekspektasi

### Test Case 2: Dengan Invoice Belum Dibayar ⏳

**Steps:**
1. Buka customer dengan invoice aktif (status: pending/unpaid)
2. Klik "Tambah Kontrak Baru"
3. Isi form dan submit

**Expected Result:**
- Pesan sukses dengan peringatan jumlah invoice belum dibayar

**Actual Result:**
- ⏳ Menunggu customer dengan invoice untuk testing lengkap

### Test Case 3: Dengan Invoice Sudah Dibayar ⏳

**Steps:**
1. Buka customer dengan invoice aktif (status: paid)
2. Klik "Tambah Kontrak Baru"
3. Isi form dan submit

**Expected Result:**
- Pesan sukses standar tanpa peringatan invoice

**Actual Result:**
- ⏳ Menunggu customer dengan invoice untuk testing lengkap

---

## Rekomendasi Lanjutan

### 1. Tambahkan Link Langsung ke Tab Invoice

**Saat ini:**
```
⚠️ PERHATIAN: Terdapat 2 invoice yang belum dibayar. Silakan periksa dan update invoice...
```

**Usulan:**
```
⚠️ PERHATIAN: Terdapat 2 invoice yang belum dibayar. 
[Lihat Invoice →] untuk update invoice karena perubahan kontrak.
```

### 2. Auto-trigger Recalculate Invoice

Ketika perubahan kontrak terjadi, otomatis trigger `recalculateUnpaidInvoiceSchedule` untuk invoice yang belum dibayar.

**Implementasi:**
```javascript
if (unpaidInvoices.length > 0) {
  // Auto-recalculate unpaid invoices
  await recalculateUnpaidInvoiceSchedule();
  
  setDocumentFeedback(
    `Riwayat perubahan kontrak berhasil dibuat. ${unpaidInvoices.length} invoice yang belum dibayar telah di-recalculate otomatis. Silakan periksa di tab Invoice.`,
  );
}
```

### 3. Notifikasi di Tab Invoice

Tambahkan banner di tab Invoice yang menunjukkan bahwa invoice perlu di-review karena ada perubahan kontrak.

### 4. Log Aktivitas

Catat perubahan kontrak dan dampaknya ke invoice di activity log untuk audit trail.

---

## Dampak ke Sistem

### Performa

- **Minimal Impact** - Hanya menambah 1 filter operation pada array `activeInvoices`
- **No Additional API Call** - Menggunakan data yang sudah di-load
- **Client-side Processing** - Tidak menambah beban server

### Kompatibilitas

- ✅ Backward compatible - Tidak mengubah struktur data
- ✅ No breaking changes - Hanya menambah logic kondisional
- ✅ Works with existing invoice system

### User Experience

- ✅ Informasi lebih jelas tentang dampak perubahan kontrak
- ✅ Mengurangi risiko invoice tidak ter-update
- ✅ Membantu user mengambil tindakan yang tepat

---

## Kesimpulan

Implementasi peringatan invoice untuk perubahan kontrak telah **berhasil ditambahkan** dengan fitur:

1. ✅ Deteksi otomatis invoice belum dibayar
2. ✅ Peringatan kondisional berdasarkan status invoice
3. ✅ Pesan yang jelas dan actionable
4. ✅ Integrasi seamless dengan sistem existing

**Status:** Siap untuk testing dengan customer yang memiliki invoice aktif.

**Next Steps:**
1. Testing dengan customer yang memiliki invoice
2. Implementasi rekomendasi lanjutan (opsional)
3. Update dokumentasi user manual

---

## Referensi Kode

- **File:** `frontend/src/features/pelanggan/TenantDetailPage.jsx`
- **Fungsi:** `handleCreateVersion` (baris 1502-1542)
- **Related Functions:**
  - `recalculateUnpaidInvoiceSchedule` (baris 1344-1402)
  - `getInvoiceWorkflowMeta` (baris 689-832)
  - `getInvoiceSetupWarnings` (baris 667-687)

---

**Dokumentasi dibuat:** 2026-05-21  
**Versi:** 1.0
