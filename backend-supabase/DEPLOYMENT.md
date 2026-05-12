# Deployment Guide - Backend Supabase

Panduan lengkap untuk deploy backend Supabase Edge Functions.

---

## Prerequisites

1. **Akun Supabase** - Sign up di https://supabase.com
2. **Supabase CLI** - Install CLI tool
3. **Git** - Repository sudah di GitHub

---

## Step 1: Install Supabase CLI

### macOS
```bash
brew install supabase/tap/supabase
```

### Linux/WSL
```bash
curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh
```

### Windows
```bash
scoop install supabase
```

---

## Step 2: Create Supabase Project

1. Buka https://supabase.com/dashboard
2. Klik **"New Project"**
3. Isi form:
   - **Name:** `sistem-fo-kima`
   - **Database Password:** (buat password kuat, simpan!)
   - **Region:** `Southeast Asia (Singapore)`
4. Klik **"Create new project"**
5. Tunggu ~2 menit sampai project ready

---

## Step 3: Get Project Credentials

Di Supabase Dashboard:

1. Klik **Settings** (icon gear)
2. Klik **API** di sidebar
3. Copy credentials:
   - **Project URL:** `https://xxx.supabase.co`
   - **anon public key:** `eyJhbGc...`
   - **service_role key:** `eyJhbGc...` (secret!)

4. Klik **Database** di sidebar
5. Copy **Connection string** (URI format)

---

## Step 4: Setup Local Environment

```bash
cd backend-supabase

# Copy environment template
cp .env.example .env

# Edit .env dengan credentials dari Step 3
nano .env
```

Isi `.env`:
```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
```

---

## Step 5: Login Supabase CLI

```bash
supabase login
```

Browser akan terbuka, authorize CLI.

---

## Step 6: Link Project

```bash
supabase link --project-ref xxx
```

Ganti `xxx` dengan project ref dari dashboard URL: `https://supabase.com/dashboard/project/xxx`

---

## Step 7: Setup Database Schema

### Apply Migrations

```bash
supabase db push
```

Ini akan apply migration file `20260512000000_initial_schema.sql` ke database.

### Verify Schema

```bash
supabase db diff
```

Harusnya output: `No schema changes detected`

---

## Step 8: Setup Storage Bucket

Di Supabase Dashboard:

1. Klik **Storage** di sidebar
2. Klik **"Create a new bucket"**
3. Isi form:
   - **Name:** `documents`
   - **Public bucket:** ✅ (centang)
4. Klik **"Create bucket"**

### Setup Storage Policies

Klik bucket `documents` → **Policies** → **New Policy**

**Policy 1: Allow authenticated users to upload**
```sql
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');
```

**Policy 2: Allow public read**
```sql
CREATE POLICY "Allow public read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'documents');
```

**Policy 3: Allow authenticated delete**
```sql
CREATE POLICY "Allow authenticated delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
```

---

## Step 9: Deploy Edge Functions

### Deploy All Functions

```bash
supabase functions deploy
```

### Deploy Specific Function

```bash
supabase functions deploy customers
supabase functions deploy documents
supabase functions deploy monitoring
```

### Verify Deployment

```bash
supabase functions list
```

Output:
```
┌─────────────┬────────────┬─────────────────────────┐
│ NAME        │ STATUS     │ UPDATED AT              │
├─────────────┼────────────┼─────────────────────────┤
│ customers   │ ACTIVE     │ 2026-05-12 01:30:00     │
│ documents   │ ACTIVE     │ 2026-05-12 01:30:05     │
│ monitoring  │ ACTIVE     │ 2026-05-12 01:30:10     │
└─────────────┴────────────┴─────────────────────────┘
```

---

## Step 10: Test Edge Functions

### Test Customers API

```bash
curl -i --location --request GET \
  'https://xxx.supabase.co/functions/v1/customers' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'apikey: YOUR_ANON_KEY'
```

### Test Monitoring API

```bash
curl -i --location --request GET \
  'https://xxx.supabase.co/functions/v1/monitoring/billing?year=2026' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'apikey: YOUR_ANON_KEY'
```

---

## Step 11: Setup Frontend Environment

Update frontend environment variables di Vercel:

```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

**Atau** jika tetap pakai REST API style:

```bash
VITE_API_BASE_URL=https://xxx.supabase.co/functions/v1
```

---

## Step 12: Deploy Frontend ke Vercel

1. Buka https://vercel.com
2. **Import Project** → Connect GitHub
3. Select repository: `sistem-fo-kima`
4. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. **Environment Variables:**
   - Add `VITE_SUPABASE_URL`
   - Add `VITE_SUPABASE_ANON_KEY`
6. Klik **"Deploy"**

---

## Step 13: Setup Custom Domain (Optional)

### Di Niagahoster DNS:

Tambah CNAME records:

```
Type: CNAME
Name: app
Value: cname.vercel-dns.com
TTL: 3600
```

```
Type: CNAME
Name: api
Value: xxx.supabase.co
TTL: 3600
```

### Di Vercel:

1. Project Settings → **Domains**
2. Add domain: `app.yourdomain.com`
3. Follow DNS verification

### Update Frontend Env:

```bash
VITE_API_BASE_URL=https://api.yourdomain.com/functions/v1
```

---

## Troubleshooting

### Edge Function Timeout

Edge Functions timeout setelah 50 detik. Jika ada operasi lama:
- Pindahkan logic ke Database Triggers
- Gunakan Background Jobs

### CORS Issues

Jika ada CORS error, pastikan headers sudah benar di Edge Function:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

### Storage Upload Failed

Pastikan:
- Bucket `documents` sudah dibuat
- Policies sudah di-setup
- File size < 50MB

### Database Connection Issues

Gunakan connection pooler untuk production:

```
postgresql://postgres:password@db.xxx.supabase.co:6543/postgres
```

Port 6543 = pooler, Port 5432 = direct

---

## Monitoring & Logs

### View Edge Function Logs

```bash
supabase functions logs customers
```

### View Database Logs

Di Supabase Dashboard → **Logs** → **Database**

### View Storage Logs

Di Supabase Dashboard → **Logs** → **Storage**

---

## Update & Redeploy

### Update Edge Function

1. Edit file di `supabase/functions/`
2. Deploy ulang:

```bash
supabase functions deploy customers
```

### Update Database Schema

1. Edit Prisma schema di `../backend/prisma/schema.prisma`
2. Generate migration:

```bash
cd ../backend
DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
  npx prisma migrate diff \
  --from-empty \
  --to-schema ./prisma/schema.prisma \
  --script > ../backend-supabase/supabase/migrations/$(date +%Y%m%d%H%M%S)_update.sql
```

3. Apply migration:

```bash
cd ../backend-supabase
supabase db push
```

---

## Rollback ke NestJS Backend

Jika ingin kembali ke NestJS backend:

1. Deploy backend NestJS ke VPS/Railway
2. Update frontend env di Vercel:

```bash
VITE_API_BASE_URL=https://api.yourdomain.com
```

3. Done! Zero downtime.

---

## Cost Estimation

### Supabase Free Tier:
- Database: 500MB
- Storage: 1GB
- Edge Functions: 500K invocations/month
- Bandwidth: 2GB

### Vercel Free Tier:
- Bandwidth: 100GB
- Build time: 6000 minutes/month

**Total: $0/month** untuk development/MVP

---

## Next Steps

1. ✅ Setup Supabase Auth
2. ✅ Setup Row Level Security (RLS)
3. ✅ Setup Database Triggers untuk automation
4. ✅ Refactor remaining modules (contracts, invoices, ISPs)
5. ✅ Setup monitoring & alerts

---

## Support

- Supabase Docs: https://supabase.com/docs
- Edge Functions: https://supabase.com/docs/guides/functions
- Deno Manual: https://deno.land/manual
