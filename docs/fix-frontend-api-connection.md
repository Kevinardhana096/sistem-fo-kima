# Fix: Frontend API Connection Issue

**Tanggal:** 2026-05-12  
**Masalah:** Frontend mencoba connect ke URL yang salah  
**Status:** ✅ FIXED

---

## 🐛 Masalah yang Terjadi

### **Error Message:**
```
Permintaan melebihi 10 detik. Periksa backend di https://sistem-fo-kima.netlify.app:4000.
```

### **Root Cause:**
Frontend menggunakan `window.location.hostname` sebagai fallback untuk API URL. Ketika dibuka di Netlify (`https://sistem-fo-kima.netlify.app`), frontend mencoba connect ke:

```
https://sistem-fo-kima.netlify.app:4000  ❌ SALAH!
```

URL ini tidak valid karena:
1. Netlify tidak menjalankan backend di port 4000
2. Backend production ada di Supabase, bukan Netlify
3. Port 4000 hanya untuk local development

---

## ✅ Solusi

### **File yang Dibuat:**

1. **`frontend/.env.development`** (Local)
   ```env
   VITE_API_BASE_URL=http://localhost:4000
   ```

2. **`frontend/.env.production`** (Netlify/Production)
   ```env
   VITE_API_BASE_URL=https://jkzjqzskrzcdmahrikwm.supabase.co/functions/v1
   ```

### **Cara Kerja:**
- **Local development:** Frontend connect ke `http://localhost:4000` (NestJS backend)
- **Production (Netlify):** Frontend connect ke Supabase Edge Functions

---

## 🔧 Implementasi

### **1. Local Development (Sudah Fixed)**
- ✅ File `.env.development` sudah dibuat
- ✅ Frontend sudah di-restart
- ✅ Sekarang connect ke `http://localhost:4000`

### **2. Production (Netlify) - Perlu Deploy**

**STEP 1: Commit file .env ke Git**
```bash
cd /home/asus_vivobook/projects/sistem-fo-kima
git add frontend/.env.development frontend/.env.production
git commit -m "fix: add environment files for API base URL"
git push origin main
```

**STEP 2: Netlify akan auto-deploy**
- Netlify akan detect perubahan di Git
- Build dengan `npm run build` (menggunakan `.env.production`)
- Deploy otomatis

**STEP 3: Verifikasi di Netlify Dashboard**
1. Login ke https://app.netlify.com
2. Pilih site **sistem-fo-kima**
3. Buka **Site settings** → **Environment variables**
4. Pastikan `VITE_API_BASE_URL` ter-set (opsional, karena sudah di `.env.production`)

---

## 📋 Checklist

### **Local Development:**
- [x] File `.env.development` dibuat
- [x] Frontend di-restart
- [x] Test API connection ke `localhost:4000`
- [x] Backend local running di port 4000

### **Production (Netlify):**
- [ ] File `.env.production` di-commit ke Git
- [ ] Push ke repository
- [ ] Netlify auto-deploy
- [ ] Test frontend production connect ke Supabase
- [ ] Verifikasi login berfungsi

---

## 🧪 Testing

### **Test Local:**
```bash
# 1. Pastikan backend running
curl http://localhost:4000/api/health

# 2. Buka frontend
open http://localhost:5173

# 3. Cek console browser (F12)
# Seharusnya tidak ada error "Permintaan melebihi 10 detik"
```

### **Test Production (Setelah Deploy):**
```bash
# 1. Buka frontend production
open https://sistem-fo-kima.netlify.app

# 2. Cek Network tab di browser (F12)
# Request seharusnya ke: https://jkzjqzskrzcdmahrikwm.supabase.co/functions/v1/api/...

# 3. Test login dengan akun admin
# Username: admin
# Password: Admin@2026
```

---

## 🔍 Debugging

### **Cek API URL yang Digunakan:**

Buka browser console (F12) dan jalankan:
```javascript
// Di local development
console.log(import.meta.env.VITE_API_BASE_URL);
// Expected: http://localhost:4000

// Di production
console.log(import.meta.env.VITE_API_BASE_URL);
// Expected: https://jkzjqzskrzcdmahrikwm.supabase.co/functions/v1
```

### **Jika Masih Error:**

1. **Clear browser cache** (Ctrl+Shift+Delete)
2. **Hard reload** (Ctrl+Shift+R)
3. **Cek Network tab** untuk lihat request URL
4. **Cek console** untuk error messages

---

## 📝 Notes

### **Perbedaan Environment:**

| Environment | API Base URL | Backend |
|-------------|--------------|---------|
| Local Development | `http://localhost:4000` | NestJS (Docker) |
| Production (Netlify) | `https://[project].supabase.co/functions/v1` | Supabase Edge Functions |

### **Fallback Logic (utils.js):**

Jika `VITE_API_BASE_URL` tidak di-set, frontend akan fallback ke:
```javascript
const fallbackBaseUrl = `${protocol}//${hostname}:4000`;
```

Ini **TIDAK AMAN** untuk production, karena akan menggunakan hostname Netlify.

**Solusi:** Selalu set `VITE_API_BASE_URL` di environment variables.

---

## ⚠️ PENTING untuk Production

### **Backend Production Belum Ada!**

Saat ini, Supabase Edge Functions **belum di-deploy**. Yang perlu dilakukan:

1. **Deploy Edge Functions ke Supabase:**
   ```bash
   cd backend-supabase
   supabase functions deploy
   ```

2. **Atau gunakan NestJS backend di VPS/Cloud:**
   - Deploy NestJS ke VPS/Heroku/Railway
   - Update `.env.production` dengan URL backend tersebut

3. **Atau gunakan Supabase REST API langsung:**
   - Tidak perlu Edge Functions
   - Frontend langsung query ke Supabase REST API
   - Update frontend untuk menggunakan Supabase client

---

## ✅ Status

**Local Development:** ✅ **FIXED**
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Connection: ✅ Working

**Production:** ⚠️ **PENDING DEPLOYMENT**
- Frontend: `https://sistem-fo-kima.netlify.app`
- Backend: Belum ada (perlu deploy Edge Functions atau NestJS)
- Connection: ❌ Not working yet

---

## 🚀 Next Steps

1. ✅ Local development fixed
2. ⏳ Commit `.env` files ke Git
3. ⏳ Deploy backend production (Supabase Edge Functions atau VPS)
4. ⏳ Test production frontend + backend
5. ⏳ Deploy akun admin ke Supabase
6. ⏳ Test login production

---

**Dokumentasi ini dibuat:** 2026-05-12  
**Status terakhir:** Local fixed, Production pending
