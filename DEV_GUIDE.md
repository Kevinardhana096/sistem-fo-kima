# Development Scripts

Quick start scripts untuk development lokal.

## 🚀 Quick Start (Recommended)

### Setup pertama kali:

```bash
./dev-start.sh
```

Script ini akan:
- Start PostgreSQL dengan Docker
- Install dependencies (backend + frontend)
- Setup database (migrations + seed)
- Siap untuk development

### Jalankan development servers:

**Terminal 1 - Backend:**
```bash
./dev-backend.sh
```

**Terminal 2 - Frontend:**
```bash
./dev-frontend.sh
```

**Buka browser:** http://localhost:5173

---

## 📝 Manual Commands

### Backend

```bash
cd backend

# Install dependencies
npm install

# Setup database
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed

# Run dev server
npm run start:dev
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

---

## 🐳 Docker Compose (Full Stack)

Jika ingin jalankan semua services sekaligus:

```bash
docker compose up
```

Services:
- Backend: http://localhost:4000
- Frontend: http://localhost:5173
- PostgreSQL: localhost:5432
- Valhalla: http://localhost:8002

---

## 🔧 Troubleshooting

### Database connection error

Pastikan PostgreSQL running:

```bash
docker compose up -d db
```

### Port already in use

Kill process di port tersebut:

```bash
# Backend (port 4000)
lsof -ti:4000 | xargs kill -9

# Frontend (port 5173)
lsof -ti:5173 | xargs kill -9
```

### Prisma Client error

Regenerate Prisma Client:

```bash
cd backend
npm run prisma:generate
```

---

## 📦 Clean Install

Jika ada masalah dengan dependencies:

```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install

# Frontend
cd frontend
rm -rf node_modules package-lock.json
npm install
```
