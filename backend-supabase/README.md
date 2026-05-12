# Backend Supabase - Sistem FO KIMA

Backend alternatif menggunakan Supabase Edge Functions untuk deployment serverless.

## Arsitektur

- **Runtime:** Deno (Edge Functions)
- **Database:** Supabase PostgreSQL
- **Storage:** Supabase Storage
- **Auth:** Supabase Auth

## Setup

### 1. Install Supabase CLI

```bash
# macOS
brew install supabase/tap/supabase

# Linux/WSL
curl -fsSL https://raw.githubusercontent.com/supabase/cli/main/install.sh | sh

# Windows
scoop install supabase
```

### 2. Login ke Supabase

```bash
supabase login
```

### 3. Link ke Project

```bash
cd backend-supabase
supabase link --project-ref your-project-id
```

### 4. Setup Environment Variables

```bash
cp .env.example .env
# Edit .env dengan credentials dari Supabase dashboard
```

### 5. Run Migrations

```bash
supabase db push
```

### 6. Deploy Edge Functions

```bash
# Deploy semua functions
supabase functions deploy

# Deploy specific function
supabase functions deploy customers
```

## Development

### Run Local Supabase

```bash
supabase start
```

Ini akan start:
- PostgreSQL database (port 54322)
- API Gateway (port 54321)
- Studio UI (port 54323)
- Edge Functions runtime

### Test Edge Function Locally

```bash
supabase functions serve customers --env-file .env
```

### Test dengan curl

```bash
curl -i --location --request GET 'http://localhost:54321/functions/v1/customers' \
  --header 'Authorization: Bearer YOUR_ANON_KEY'
```

## Structure

```
backend-supabase/
├── supabase/
│   ├── functions/          # Edge Functions
│   │   ├── customers/
│   │   ├── documents/
│   │   ├── contracts/
│   │   ├── invoices/
│   │   ├── monitoring/
│   │   └── isps/
│   ├── migrations/         # SQL migrations
│   └── config.toml         # Supabase config
├── .env.example
└── README.md
```

## Edge Functions

Setiap module memiliki Edge Function sendiri:

- `customers` - Customer CRUD operations
- `documents` - Document management & upload
- `contracts` - Contract lifecycle management
- `invoices` - Invoice tracking & billing
- `monitoring` - Monitoring dashboard data
- `isps` - ISP management

## Database

Database schema di-migrate dari Prisma schema di `../backend/prisma/schema.prisma`.

Untuk update schema:
1. Edit Prisma schema di `backend/prisma/schema.prisma`
2. Generate SQL migration: `npm run generate:migration`
3. Apply ke Supabase: `supabase db push`

## Storage

File uploads menggunakan Supabase Storage dengan buckets:

- `documents` - Customer documents (contracts, invoices, etc)
- `avatars` - User profile pictures (future)

## Authentication

Menggunakan Supabase Auth dengan:
- Email/Password authentication
- Row Level Security (RLS) policies
- JWT tokens

## Deployment

### Deploy ke Supabase Production

```bash
# Deploy functions
supabase functions deploy

# Apply migrations
supabase db push --linked
```

### Environment Variables di Supabase

Set di Supabase Dashboard → Settings → Edge Functions:

```
DATABASE_URL=postgresql://...
```

## Migration dari NestJS Backend

Backend NestJS di folder `../backend/` tetap dipertahankan untuk:
- Development lokal
- Fallback jika ingin pindah ke VPS
- Reference implementation

Untuk switch antara NestJS dan Supabase:
- **Development:** Gunakan NestJS (`http://localhost:4000`)
- **Production:** Gunakan Supabase Edge Functions

Update `VITE_API_BASE_URL` di frontend untuk switch.

## Troubleshooting

### Edge Function Timeout

Edge Functions timeout setelah 50 detik. Untuk operasi lama:
- Gunakan Database Triggers
- Gunakan Background Jobs (Supabase Functions + pg_cron)

### Connection Pool Exhausted

Gunakan Supabase Connection Pooler:
```
postgresql://postgres:password@db.xxx.supabase.co:6543/postgres
```

Port 6543 = pooler, Port 5432 = direct connection

### CORS Issues

Edge Functions sudah handle CORS secara otomatis. Jika ada issue, tambahkan headers:

```typescript
return new Response(JSON.stringify(data), {
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }
})
```

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Deno Manual](https://deno.land/manual)
