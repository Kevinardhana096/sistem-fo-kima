# 📚 Dokumentasi Sistem FO KIMA

Indeks lengkap dokumentasi Sistem FO KIMA.

---

## 🚀 Quick Start

| Dokumen | Deskripsi |
|---------|-----------|
| [README.md](../README.md) | Overview project & quick start guide |
| [DEV_GUIDE.md](../DEV_GUIDE.md) | Panduan development lengkap |
| [guides/QUICK_REFERENCE.md](guides/QUICK_REFERENCE.md) | Command reference cepat |

---

## 📖 Product Requirements

| Dokumen | Deskripsi |
|---------|-----------|
| [prd/PRD-sistem-arsip-kima.md](../prd/PRD-sistem-arsip-kima.md) | Product Requirements Document (v1.1) |
| [prd/sequence-diagram-komprehensif.md](../prd/sequence-diagram-komprehensif.md) | Sequence diagram sistem |
| [prd/business-flow.png](../prd/business-flow.png) | Business flow diagram |

---

## 🚢 Deployment & Operations

| Dokumen | Deskripsi |
|---------|-----------|

### Backend Specific

| Dokumen | Deskripsi |
|---------|-----------|
| [backend/README_CENDIKIA.md](../backend/README_CENDIKIA.md) | Dokumentasi seeding PT Cendikia (backend) |
| [backend/SEEDING_CENDIKIA.md](../backend/SEEDING_CENDIKIA.md) | Detail data PT Cendikia |
| [backend/PRODUCTION_DEPLOYMENT.md](../backend/PRODUCTION_DEPLOYMENT.md) | Panduan deployment production (generic) |

### Backend-Supabase Specific

| Dokumen | Deskripsi |
|---------|-----------|
| [backend-supabase/README.md](../backend-supabase/README.md) | Overview Supabase backend |
| [backend-supabase/DEPLOYMENT.md](../backend-supabase/DEPLOYMENT.md) | Panduan deployment Supabase |
| [backend-supabase/DEPLOYMENT_CENDIKIA.md](../backend-supabase/DEPLOYMENT_CENDIKIA.md) | Deployment PT Cendikia ke Supabase |

---

## 🛠️ Development Guides

| Dokumen | Deskripsi |
|---------|-----------|
| [guides/QUICK_REFERENCE.md](guides/QUICK_REFERENCE.md) | Command reference & troubleshooting |

---

## 📜 Scripts

Semua script tersedia di folder `scripts/`:

| Script | Deskripsi |
|--------|-----------|
| [scripts/dev-start.sh](../scripts/dev-start.sh) | Start semua services (frontend + backend + docker) |
| [scripts/dev-backend.sh](../scripts/dev-backend.sh) | Start backend only |
| [scripts/dev-frontend.sh](../scripts/dev-frontend.sh) | Start frontend only |
| [scripts/seed-cendikia-supabase-full.sql](../scripts/seed-cendikia-supabase-full.sql) | SQL script lengkap untuk seeding PT Cendikia |

---

## 🏗️ Arsitektur

### Environment Setup

**Local Development:**
- Folder: `backend/` + `docker-compose.yml`
- Database: PostgreSQL via Docker (localhost:5432)
- Backend: NestJS (localhost:4000)
- Frontend: React + Vite (localhost:5173)

**Production:**
- Folder: `backend-supabase/`
- Database: Supabase PostgreSQL (cloud)
- Backend: Supabase Edge Functions (serverless)
- Frontend: Netlify

Lihat: [prd/PRD-sistem-arsip-kima.md - Section 6](../prd/PRD-sistem-arsip-kima.md#6-arsitektur-teknis)

---

## 📊 Database

### Schema & Migrations

- Schema: `backend/prisma/schema.prisma`
- Migrations: `backend/prisma/migrations/`
- Seeding: `backend/prisma/seed.ts`

### Commands

```bash
# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Seed database
npm run prisma:seed
```

---

## 🔐 Authentication

Default users (setelah seeding):

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `Admin123!` |
| Teknisi | `teknisi` | `Teknisi123!` |
| ISP | `isp` | `Isp12345!` |

---

## 🗺️ Route Planner (Valhalla)

- Service: Valhalla routing engine
- Data: OSM Sulawesi (`infra/valhalla/data/sulawesi.osm.pbf`)
- Port: 8002
- Endpoint: `POST http://localhost:8002/route`

---

## 📝 API Documentation

Lihat: [README.md - API Endpoints](../README.md#-api-endpoints)

---

## 🤝 Contributing

1. Baca [DEV_GUIDE.md](../DEV_GUIDE.md)
2. Create feature branch
3. Make changes & test locally
4. Create pull request

---

## 📞 Support

Untuk pertanyaan atau issue:
1. Check dokumentasi di folder ini
2. Check [QUICK_REFERENCE.md](guides/QUICK_REFERENCE.md) untuk troubleshooting
3. Contact development team

---

**Last Updated:** 2026-05-12  
**Maintained By:** Development Team
