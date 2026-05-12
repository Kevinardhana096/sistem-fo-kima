# 🚀 QUICK REFERENCE - PT Cendikia Deployment

## ⚡ Quick Commands

### Local Database
```bash
cd backend
npm run prisma:seed:cendikia      # Seed data
npm run prisma:verify:cendikia    # Verify data
npm run prisma:rollback:cendikia  # Rollback data
```

### Supabase Production
```bash
cd backend-supabase
npm install                       # First time only
npm run seed:cendikia            # Seed data
npm run verify:cendikia          # Verify data
npm run rollback:cendikia        # Rollback data
./deploy-production.sh           # Automated deployment
```

## 📋 Supabase Credentials Checklist

Get from: https://supabase.com/dashboard → Your Project

- [ ] Settings → API → SUPABASE_URL
- [ ] Settings → API → SUPABASE_ANON_KEY
- [ ] Settings → API → SUPABASE_SERVICE_ROLE_KEY
- [ ] Settings → Database → Connection String (use pooler port 6543)

## 📝 .env Template

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres.xxxxx:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
```

## ✅ Expected Results

```
✅ Customer found: PT Cendikia Global Solusi
✅ Contracts: 8 found
✅ Invoices: 91 found
✅ Total Amount: Rp 22.750.000
✅ Documents: 99 found
```

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Connection timeout | Use port 6543 (pooler), not 5432 |
| Customer exists | Run `npm run rollback:cendikia` first |
| Permission denied | Check DATABASE_URL credentials |
| SSL required | Add `?sslmode=require` to DATABASE_URL |

## 📚 Documentation

- **SQL Seed:** `scripts/seed-cendikia-supabase-full.sql`
- **Supabase Guide:** `backend-supabase/DEPLOYMENT_CENDIKIA.md`
- **Local Guide:** `backend/README_CENDIKIA.md`

## 🎯 Deployment Steps (5 minutes)

1. **Get credentials** from Supabase Dashboard
2. **Create .env** in `backend-supabase/`
3. **Install deps:** `npm install`
4. **Backup** production database
5. **Deploy:** `./deploy-production.sh`
6. **Verify:** Check output and test frontend

## 📊 Data Summary

- Customer: PT Cendikia Global Solusi
- Contracts: 8 (BTN: 4, Wastec: 4)
- Invoices: 91 (all paid)
- Total: Rp 22.750.000
- Period: 2022-2026

---

**Status:** ✅ Ready to Deploy
**Last Updated:** 2026-05-12
