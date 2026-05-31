# Supabase Setup Guide

**Tanggal:** 2026-05-12  
**Status:** Ready to Execute

---

## 🎯 Tujuan

Panduan langkah demi langkah untuk setup Supabase Auth dan Row Level Security (RLS) untuk production deployment.

---

## 📋 Prerequisites

- Akses ke Supabase Dashboard: https://supabase.com/dashboard
- Project Supabase sudah dibuat
- Database sudah ter-migrate dengan schema terbaru

---

## 🔐 Step 1: Create Auth Users dan Mapping ISP

### **1.1. Login ke Supabase Dashboard**
1. Buka https://supabase.com/dashboard
2. Pilih project: `sistem-fo-kima`

### **1.2. Buka SQL Editor**
1. Klik menu **SQL Editor** di sidebar kiri
2. Klik **New Query**

### **1.3. Run Auth Users Script**
1. Copy isi file `scripts/auth/create-supabase-auth-users.sql`
2. Paste ke SQL Editor
3. Klik **Run** atau tekan `Ctrl+Enter`

### **1.4. Verify Users Created**
Script akan otomatis menampilkan hasil verifikasi:
```
email                | role     | display_name   | email_confirmed_at
---------------------|----------|----------------|-------------------
admin@kima.local     | admin    | Administrator  | 2026-05-12 ...
isp@kima.local       | isp      | ISP User       | 2026-05-12 ...
teknisi@kima.local   | teknisi  | Teknisi        | 2026-05-12 ...
```

### **1.5. Map Akun ISP ke Entitas ISP (Wajib untuk role ISP)**
1. Pastikan data ISP sudah ada di tabel `public.isps`
2. Copy isi file `scripts/auth/map-isp-users.sql`
3. Sesuaikan nilai email + nama ISP pada CTE `mapping_input`
4. Jalankan query

Contoh hasil verifikasi:
```
email           | isp_name
----------------|------------------------------
isp@kima.local  | PT Cendikia Global Solusi
```

### **1.6. Test Login (Optional)**
Buka **Authentication** → **Users** di Supabase Dashboard untuk melihat users yang baru dibuat.

---

## 🔒 Step 2: Setup Row Level Security (RLS)

### **2.1. Buka SQL Editor Baru**
1. Klik **SQL Editor** di sidebar
2. Klik **New Query**

### **2.2. Run RLS Policies Script**
1. Copy isi file `scripts/rls/setup-supabase-rls-policies.sql`
2. Paste ke SQL Editor
3. Klik **Run** atau tekan `Ctrl+Enter`

⚠️ **Note:** Script ini akan:
- Enable RLS pada semua tabel
- Create helper function `public.get_user_role()` dan `public.get_current_user_isp_id()`
- Create table mapping `public.isp_user_accounts` untuk enforce `1 akun ISP = 1 ISP`
- Create policies untuk admin, isp, dan teknisi roles

### **2.3. Verify Policies Created**
Script akan otomatis menampilkan semua policies yang dibuat:
```
tablename                    | policyname                        | cmd
-----------------------------|-----------------------------------|--------
customers                    | Admin full access on customers    | ALL
customers                    | ISP read own customers            | SELECT
customers                    | Teknisi read all customers        | SELECT
isps                         | Admin full access on isps         | ALL
...
```

### **2.4. Manual Verification (Optional)**
Buka **Database** → **Tables** → pilih table → tab **Policies** untuk melihat policies per table.

---

## 🧪 Step 3: Test Authentication

### **3.1. Test Login via Frontend**
1. Buka frontend development: `npm run dev`
2. Klik salah satu Dev Quick Access button:
   - **Admin**: admin@kima.local / <lihat password manager>
   - **Teknisi**: teknisi@kima.local / <lihat password manager>
   - **ISP**: isp@kima.local / <lihat password manager>

### **3.2. Expected Behavior**
- ✅ Login berhasil
- ✅ Redirect ke dashboard sesuai role
- ✅ Data customers muncul sesuai role access

### **3.3. Test Role-Based Access**
**Admin:**
- ✅ Bisa lihat semua customers
- ✅ Bisa create/update/delete customers
- ✅ Bisa lihat semua ISPs

**ISP:**
- ✅ Bisa lihat customers yang terkait dengan ISP mereka
- ❌ Tidak bisa lihat customers ISP lain
- ❌ Tidak bisa create/update/delete
- ❌ Tidak bisa akses data bila belum dimapping ke `public.isp_user_accounts`

**Teknisi:**
- ✅ Bisa lihat semua customers (read-only)
- ✅ Bisa lihat semua ISPs (read-only)
- ❌ Tidak bisa create/update/delete

---

## 🔍 Step 4: Troubleshooting

### **Problem: "new row violates row-level security policy"**
**Cause:** RLS policy tidak mengizinkan operasi tersebut.

**Solution:**
1. Check user role di `auth.users.raw_user_meta_data`
2. Verify policy untuk role tersebut
3. Check apakah user memiliki akses ke resource

### **Problem: "permission denied for table X"**
**Cause:** RLS belum di-enable atau policy belum dibuat.

**Solution:**
1. Run `setup-supabase-rls-policies.sql` lagi
2. Verify dengan query:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### **Problem: Login gagal dengan "Invalid login credentials"**
**Cause:** User belum dibuat atau password salah.

**Solution:**
1. Check di **Authentication** → **Users**
2. Re-run `create-supabase-auth-users.sql` jika perlu
3. Pastikan password sesuai: <lihat password manager>, <lihat password manager>, <lihat password manager>

### **Problem: User bisa lihat data yang seharusnya tidak bisa**
**Cause:** RLS policy terlalu permissive.

**Solution:**
1. Review policy di `setup-supabase-rls-policies.sql`
2. Test dengan query manual:
```sql
-- Set role context
SET request.jwt.claims = '{"user_metadata":{"role":"isp"}}';

-- Test query
SELECT * FROM customers;
```

### **Problem: User ISP login tapi tidak melihat data**
**Cause:** Akun ISP belum dimapping ke tabel `public.isp_user_accounts`.

**Solution:**
1. Check mapping yang sudah ada:
```sql
SELECT au.email, i.name AS isp_name
FROM public.isp_user_accounts iua
JOIN auth.users au ON au.id = iua.auth_user_id
JOIN public.isps i ON i.id = iua.isp_id
ORDER BY au.email;
```
2. Jalankan `scripts/auth/map-isp-users.sql`
3. Pastikan email auth user dan nama ISP cocok

---

## 📊 Step 5: Monitoring

### **5.1. Check Auth Logs**
1. Buka **Authentication** → **Logs**
2. Monitor login attempts dan errors

### **5.2. Check Database Logs**
1. Buka **Database** → **Logs**
2. Monitor RLS policy violations

### **5.3. Check API Logs**
1. Buka **API** → **Logs**
2. Monitor REST API calls dari frontend

---

## ✅ Checklist

Sebelum deploy ke production, pastikan:

- [ ] Auth users sudah dibuat (admin, teknisi, isp)
- [ ] Mapping akun ISP ke `public.isp_user_accounts` sudah dibuat
- [ ] RLS policies sudah di-enable pada semua tabel
- [ ] Test login untuk semua roles berhasil
- [ ] Test CRUD operations sesuai role permissions
- [ ] Test monitoring billing page
- [ ] Test customer detail page
- [ ] Test ISP detail page
- [ ] Frontend `.env.production` sudah benar
- [ ] Supabase anon key sudah di-set di environment variables

---

## 🚀 Deploy to Production

Setelah semua checklist di atas selesai:

1. Commit semua changes:
```bash
git add .
git commit -m "feat: refactor to Supabase direct access with RLS"
git push origin main
```

2. Netlify akan auto-deploy frontend
3. Test production URL
4. Monitor logs untuk errors

---

## 📚 Resources

- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript)

---

**Last Updated:** 2026-05-18
