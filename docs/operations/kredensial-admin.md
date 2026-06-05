# 🔐 Kredensial Admin - Production Supabase

> **CATATAN KEAMANAN.** Jangan menyimpan password atau hash asli di file ini
> atau di mana pun dalam repository. Simpan kredensial nyata di password manager
> tim. Placeholder `<lihat password manager>` di bawah sengaja dipakai sebagai
> pengganti nilai rahasia.

**Tanggal Dibuat:** 2026-05-12  
**Status:** Ready to Deploy

---

## 👤 Akun Administrator

### **Kredensial Login:**

```
Username: admin
Password: <lihat password manager>
Email: admin@kima.local
Role: admin
```

---

## 📋 Cara Deploy ke Production

### **STEP 1: Login ke Supabase Dashboard**
1. Buka https://supabase.com
2. Login dengan akun Anda
3. Pilih project: **sistem-fo-kima** (<project-ref>)
4. Klik menu **SQL Editor** di sidebar kiri

### **STEP 2: Jalankan Script Insert Admin**
1. Di SQL Editor, klik **New Query**
2. Copy seluruh isi file: `scripts/auth/insert-admin-user-production.sql`
3. Paste ke SQL Editor
4. Klik tombol **Run** (atau tekan Ctrl+Enter)

**Expected Output:**
```
BEGIN
INSERT 0 1
COMMIT
```

### **STEP 3: Verifikasi Admin User**
Jalankan query ini untuk memastikan admin sudah dibuat:

```sql
SELECT id, username, email, role, display_name, is_active
FROM users
WHERE username = 'admin';
```

**Expected Output:**
```
id | username | email              | role  | display_name  | is_active
---+----------+--------------------+-------+---------------+-----------
1  | admin    | admin@kima.local   | admin | Administrator | true
```

---

## 🧪 Test Login

## 🔗 URL Register Admin Tersembunyi

Frontend menyediakan halaman register admin khusus untuk kebutuhan provisioning awal:

```text
/kima-admin/register-7f4c9a2e
```

Contoh lokal:

```text
http://localhost:5173/kima-admin/register-7f4c9a2e
```

Contoh production:

```text
https://<domain-production>/kima-admin/register-7f4c9a2e
```

Form ini membuat akun Supabase Auth dengan metadata:

```json
{
  "role": "admin",
  "display_name": "Administrator"
}
```

Catatan keamanan:
- URL ini tidak ditampilkan di menu aplikasi.
- Jangan sebar URL di kanal publik.
- URL tersembunyi bukan pengganti proteksi server-side. Untuk production yang lebih ketat, pembuatan admin sebaiknya dilakukan melalui Supabase Dashboard, SQL reviewed script, Edge Function, atau RPC admin-only dengan validasi server-side.
- Jika Supabase Auth email confirmation aktif, user harus verifikasi email sebelum bisa login.
- Setelah akun berhasil dibuat, simpan kredensial nyata hanya di password manager.

### **Via Frontend:**
1. Buka aplikasi frontend production
2. Masuk ke halaman login
3. Masukkan kredensial:
   - Username: `admin`
   - Password: `<lihat password manager>`
4. Klik Login
5. Harus redirect ke Dashboard dengan full access

### **Via API (Optional):**
```bash
curl -X POST "https://[your-api-url]/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "<lihat password manager>"
  }'
```

**Expected Response:**
```json
{
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "displayName": "Administrator"
  }
}
```

---

## 🔒 Keamanan

### **Password Policy:**
- Minimal 8 karakter
- Mengandung huruf besar (A-Z)
- Mengandung huruf kecil (a-z)
- Mengandung angka (0-9)
- Mengandung simbol (@, #, $, dll)

### **Password Hash:**
- Algoritma: bcrypt
- Rounds: 10
- Hash: `<bcrypt hash - jangan simpan di repo>`

### **⚠️ PENTING - Ganti Password Setelah Login Pertama!**

Setelah login pertama kali, **SEGERA GANTI PASSWORD** untuk keamanan:

1. Login dengan kredensial default
2. Buka menu **Profile** atau **Settings**
3. Pilih **Change Password**
4. Masukkan password baru yang kuat
5. Simpan perubahan

**Password baru harus:**
- Berbeda dari default
- Minimal 12 karakter
- Kombinasi huruf, angka, dan simbol
- Tidak mudah ditebak

---

## 👥 Akun Lain (Opsional)

Jika perlu akun untuk role lain:

### **ISP User:**
```
Username: isp_user
Password: <lihat password manager>
Role: isp
```

### **Teknisi User:**
```
Username: teknisi
Password: <lihat password manager>
Role: teknisi
```

**Script untuk insert akun lain tersedia di:**
- `scripts/insert-all-users-production.sql` (jika diperlukan)

---

## 🔄 Rollback (Jika Perlu)

Jika ada masalah dan perlu hapus akun admin:

```sql
DELETE FROM users WHERE username = 'admin';
```

Lalu jalankan ulang script insert.

---

## 📝 Notes

1. **Username unik** - Tidak bisa ada 2 user dengan username sama
2. **Email unik** - Tidak bisa ada 2 user dengan email sama
3. **Role admin** - Memiliki akses penuh ke semua fitur
4. **is_active = true** - Akun aktif dan bisa login
5. **Password hash** - Tidak bisa di-decrypt, hanya bisa di-verify

---

## ✅ Checklist Deployment

- [ ] Script `insert-admin-user-production.sql` sudah di-copy
- [ ] Login ke Supabase Dashboard
- [ ] Buka SQL Editor
- [ ] Paste dan Run script
- [ ] Verifikasi admin user sudah ada
- [ ] Test login via frontend
- [ ] Login berhasil dengan kredensial default
- [ ] **GANTI PASSWORD** setelah login pertama
- [ ] Simpan password baru di tempat aman (password manager)

---

## 🎯 Summary

**File Script:** `/scripts/auth/insert-admin-user-production.sql`

**Kredensial Default:**
```
Username: admin
Password: <lihat password manager>
```

**⚠️ WAJIB GANTI PASSWORD SETELAH LOGIN PERTAMA!**

---

**Selamat menggunakan! 🚀**
