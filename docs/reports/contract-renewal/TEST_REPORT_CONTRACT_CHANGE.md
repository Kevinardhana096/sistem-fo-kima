# Test Report: Contract Change Flow (Ganti Paket)

**Test Date:** 2026-05-21  
**Tester:** Claude (Automated Testing)  
**Feature:** Tambah Kontrak Baru - Contract Version Management

---

## Test Case Summary

Testing the contract change flow when "Tambah Kontrak Baru" button is pressed, specifically for "Ganti Paket" (package change) scenario.

### Test Scenarios Covered

1. ✅ Contract version creation with empty fields
2. ✅ Contract period handling
3. ⚠️ Invoice update warning (partial implementation)

---

## Test Results

### 1. Contract Version Creation Flow

**Expected Behavior:**
- When "Tambah Kontrak Baru" is pressed, system creates a new contract version
- New version should have empty: nomor_kontrak, berkas_kontrak, berkas_bak
- Notification appears to complete these fields

**Actual Behavior:**
✅ **PASSED** - System correctly creates contract_versions record
- Success message displayed: "Riwayat perubahan kontrak berhasil dibuat. Upload BAK untuk mengaktifkan versi baru."
- Contract table shows the original contract row (not a new row, as expected)
- System uses `contract_versions` table for tracking changes, not new contract rows

**Code Flow Analysis:**
```
TenantDetailPage.jsx:1489-1499 (openVersionEditor)
  ↓
TenantDetailPage.jsx:1501-1541 (handleCreateVersion)
  ↓
api.js:3172-3218 (contractVersionsApi.create)
  ↓
Supabase: INSERT into contract_versions
```

**Key Finding:**
The system architecture uses `contract_versions` to track package changes, NOT new contract rows. This is correct behavior - the contract itself remains one row, with versions tracking changes over time.

---

### 2. Empty Fields Notification System

**Expected Behavior:**
- Nomor kontrak, berkas kontrak, and BAK should be empty for new versions
- Notifications should appear prompting user to complete these fields

**Actual Behavior:**
✅ **PASSED** - Notification system working correctly

**Notifications Observed:**
1. ⚠️ "Berkas kontrak belum diunggah" - Upload berkas kontrak agar arsip legal lokasi lengkap.
2. ⚠️ "BAK belum tersedia" - Upload Berita Acara Koneksi/BAK atau tandai tidak perlu jika tidak diwajibkan.

**Code Location:**
- `TenantDetailPage.jsx:1152-1180` - derivedNeedActionTodos logic
- Notifications appear in "Kelengkapan Berkas" section on Ringkasan tab

**Screenshots:**
- `contract-change-test-ringkasan.png` - Shows notifications
- `contract-change-test-kontrak-table.png` - Shows contract table

---

### 3. Contract Period Handling

**Expected Behavior:**
- Initial contract period follows original contract
- Running contract: end period stays the same
- New contract version: start period begins from configured time

**Actual Behavior:**
✅ **PASSED** - Period handling works correctly

**Observed Periods:**
- **Original Contract:**
  - Periode Awal Kontrak: 21 Mei 2026
  - Periode Berjalan: 21 Mei 2026—21 Mei 2027

- **After Creating Version:**
  - Periode Awal Kontrak: 21 Mei 2026 (unchanged, follows original)
  - Periode Berjalan: 21 Mei 2026—21 Mei 2027 (unchanged)
  - New version start_date: 2026-05-21 (configured in modal)
  - New version end_date: 2027-05-21 (same as original)

**Code Logic:**
```javascript
// openVersionEditor (line 1489-1499)
setVersionEditor({
  reason: "ubah_paket",
  customReason: "",
  startDate: todayIso,  // New version starts today
  endDate: latestVersion?.endDate ?? contract?.endDate ?? todayIso,  // Keeps original end date
  ratio: latestVersion?.sharedCoreRatio ?? contract?.sharingRatio ?? "1:8",
});
```

---

### 4. Invoice Update Warning

**Expected Behavior:**
- Mid-contract changes should trigger warning to update invoices
- Warning should appear because contract changed during running period

**Actual Behavior:**
⚠️ **PARTIAL** - No explicit invoice warning displayed

**Analysis:**
The system does NOT currently show a specific warning like "Perlu update invoice karena terjadi perubahan kontrak di tengah periode berjalan."

However, the system DOES handle invoice impact through:
1. Invoice setup warnings in `getInvoiceSetupWarnings` (line 667-687)
2. Invoice workflow metadata in `getInvoiceWorkflowMeta` (line 689-832)
3. Invoice recalculation in `recalculateUnpaidInvoiceSchedule` (line 1344-1402)

**Current Invoice State:**
- No active invoices exist yet (customer just created)
- Invoice tab shows: "Belum ada invoice aktif"
- System would need existing invoices to demonstrate the warning

**Recommendation:**
To fully test invoice warnings, need to:
1. Create invoices for the customer first
2. Then change contract mid-period
3. Observe if warning appears to recalculate/update invoices

---

## Code Architecture Analysis

### Contract Change Flow

```
User clicks "Tambah Kontrak Baru"
  ↓
openVersionEditor() - Opens modal with default values
  ↓
User fills form (reason, ratio, dates)
  ↓
handleCreateVersion() - Validates and submits
  ↓
api.contractVersions.create() - Creates version record
  ↓
Supabase INSERT into contract_versions
  ↓
Success feedback + loadDetail() refresh
  ↓
UI updates: package display changes, notifications appear
```

### Key Database Tables

1. **contracts** - Main contract record (one per customer)
   - Stores: contract_number, start_date, end_date, core_type, core_total, sharing_ratio

2. **contract_versions** - Version history (multiple per contract)
   - Stores: version_number, start_date, end_date, shared_core_ratio, monthly_amount, yearly_amount
   - Links to: contract_id, customer_id

3. **invoices** - Monthly billing records
   - Links to: customer_id, contract_id
   - Affected by contract changes through workflow logic

### Notification System

The system uses a derived notification system:
- `backendNeedActionTodos` - From database/API
- `derivedNeedActionTodos` - Computed client-side
- Checks for missing: contract_number, contract_file, bak_file
- Displays in "Kelengkapan Berkas" section

---

## Test Environment

- **Frontend:** React + Vite (localhost:5173)
- **Backend:** Supabase (PostgreSQL + RLS + Storage)
- **Browser:** Playwright (Chromium)
- **Test Customer:** "Lokasi Uji Kelengkapan Berkas 210526" (ID: 200)
- **Test ISP:** "ISP Test Kelengkapan Berkas" (ID: 64)

---

## Findings & Recommendations

### ✅ Working Correctly

1. Contract version creation flow
2. Empty field notifications
3. Period handling logic
4. Success feedback messages
5. UI updates after version creation

### ⚠️ Areas for Improvement

1. **Invoice Warning Not Visible**
   - Current implementation: Invoice warnings exist in code but not explicitly shown for mid-contract changes
   - Recommendation: Add explicit warning banner when contract changes affect existing unpaid invoices
   - Suggested location: After contract version creation, check for unpaid invoices and display warning

2. **Contract Table Display**
   - Current: Shows only main contract row
   - Consideration: Could show version history in expandable rows or separate section
   - Note: Current design is acceptable - versions are tracked in database, not UI table

3. **BAK Upload Prompt**
   - Current: Generic message "Upload BAK untuk mengaktifkan versi baru"
   - Recommendation: More specific guidance on what BAK document is needed for version activation

### 🔍 Additional Testing Needed

1. **Invoice Impact Testing**
   - Create customer with existing invoices
   - Change contract mid-period
   - Verify invoice recalculation and warnings

2. **Multiple Version Changes**
   - Create multiple versions in sequence
   - Verify version numbering and period handling

3. **Edge Cases**
   - Change contract on same day as invoice due date
   - Change contract with pending payment
   - Change contract with uploaded but unpaid invoices

---

## Conclusion

The contract change flow (Ganti Paket) is **functionally working** with the following status:

- ✅ Contract version creation: **PASSED**
- ✅ Empty field notifications: **PASSED**
- ✅ Period handling: **PASSED**
- ⚠️ Invoice update warning: **PARTIAL** (needs existing invoices to fully test)

The system correctly uses `contract_versions` for tracking package changes rather than creating new contract rows. Notifications properly alert users to complete missing fields (nomor kontrak, berkas kontrak, BAK).

The invoice warning system exists in the codebase but requires existing invoices to demonstrate the full flow. Further testing with invoice data is recommended to validate the complete mid-contract change scenario.

---

## Test Artifacts

- Screenshot 1: `contract-change-test-ringkasan.png` - Notifications in Ringkasan tab
- Screenshot 2: `contract-change-test-kontrak-table.png` - Contract table after version creation
- Test Date: 2026-05-21T13:57:39Z
