# Sistem FO KIMA

Sistem arsip dokumen dan monitoring tenant berbasis web untuk pengelolaan ISP dan pelanggan fiber optik.

## 📁 Struktur Project

```
sistem-fo-kima/
├── frontend/              # React + Vite + Tailwind CSS
├── backend/               # NestJS API (Local Development)
├── backend-supabase/      # Supabase Edge Functions (Production)
├── docs/                  # Dokumentasi
│   ├── deployment/        # Deployment guides
│   └── guides/            # User guides & references
├── prd/                   # Product Requirements Document
├── scripts/               # Development & deployment scripts
├── infra/                 # Infrastructure configs (Docker, Valhalla)
└── docker-compose.yml     # Local development stack
```

## 🚀 Quick Start

### Development (Local)

```bash
# 1. Start PostgreSQL & Valhalla
docker-compose up -d

# 2. Start Backend
cd backend
npm install
npm run prisma:migrate
npm run prisma:seed
npm run start:dev

# 3. Start Frontend
cd ../frontend
npm install
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- Valhalla: http://localhost:8002

### Production (Supabase)

Lihat dokumentasi: `docs/deployment/`

## 📚 Dokumentasi

### Untuk Developer
- **[DEV_GUIDE.md](DEV_GUIDE.md)** - Panduan development lengkap
- **[docs/guides/QUICK_REFERENCE.md](docs/guides/QUICK_REFERENCE.md)** - Command reference cepat

### Untuk Deployment

### Product Requirements
- **[prd/PRD-sistem-arsip-kima.md](prd/PRD-sistem-arsip-kima.md)** - Product Requirements Document

## 🏗️ Arsitektur

### Local Development
- **Frontend**: React + Vite (localhost:5173)
- **Backend**: NestJS (localhost:4000)
- **Database**: PostgreSQL via Docker (localhost:5432)
- **Routing**: Valhalla (localhost:8002)

### Production
- **Frontend**: Netlify
- **Backend**: Supabase Edge Functions
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage

## 🛠️ Scripts Tersedia

### Development Scripts (di folder `scripts/`)
```bash
./scripts/dev-start.sh      # Start semua services
./scripts/dev-backend.sh    # Start backend only
./scripts/dev-frontend.sh   # Start frontend only
```

### Backend Scripts
```bash
cd backend
npm run start:dev           # Start development server
npm run prisma:migrate      # Run migrations
npm run prisma:seed         # Seed sample data
npm run prisma:seed:cendikia    # Seed PT Cendikia data
npm run prisma:verify:cendikia  # Verify seeded data
```

## 🔧 Environment Variables

### Frontend
- `VITE_API_BASE_URL` - Backend API URL (default: http://localhost:4000)
- `VITE_VALHALLA_HOST` - Valhalla routing URL (default: http://localhost:8002)

### Backend
- `DATABASE_URL` - PostgreSQL connection string
- `HOST` - Server host (default: 127.0.0.1)
- `PORT` - Server port (default: 4000)

## 📊 Database

### Migrations
```bash
cd backend
npx prisma migrate dev      # Create & apply migration
npx prisma migrate deploy   # Apply to production
npx prisma generate         # Generate Prisma Client
```

### Seeding
```bash
# Sample data
npm run prisma:seed

# Force reset & reseed
SEED_FORCE_RESET=true npm run prisma:seed

# Seed specific data (PT Cendikia)
npm run prisma:seed:cendikia
```

## 🗺️ Valhalla Route Planner

Service Valhalla untuk route planner FO menggunakan data OSM Sulawesi.

**Startup pertama:**
- Build routing tiles (~5-10 menit)
- Generate timezones & admin boundaries
- Start HTTP service

**Force rebuild:**
```bash
VALHALLA_REBUILD=1 docker-compose up -d valhalla
```

## 🔐 Authentication

Default users (setelah seeding):
- **Admin**: username `admin`, password `Admin123!`
- **Teknisi**: username `teknisi`, password `Teknisi123!`
- **ISP**: username `isp`, password `Isp12345!`

## 📝 API Endpoints

### Health Check
- `GET /api/health`

### Customers
- `GET /api/customers`
- `POST /api/customers`
- `GET /api/customers/:id`
- `PUT /api/customers/:id`
- `DELETE /api/customers/:id`
- `GET /api/customers/:id/compliance-status`
- `GET /api/customers/:id/timeline`

### Documents
- `GET /api/customers/:id/documents`
- `POST /api/customers/:id/documents`
- `DELETE /api/customers/:id/documents/:docId`

### Monitoring
- `GET /api/monitoring/billing?year=&isp=&status=`
- `GET /api/monitoring/alerts?year=`

### ISPs
- `GET /api/isps`
- `POST /api/isps`
- `GET /api/isps/:id`
- `PUT /api/isps/:id`
- `DELETE /api/isps/:id`

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Test locally
4. Create pull request

## 📄 License

Internal use only - KIMA

---

**Last Updated:** 2026-05-12  
**Version:** 1.1  
**Status:** Active Development
