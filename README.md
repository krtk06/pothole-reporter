# Pothole Reporter

A full-stack pothole reporting application with map-based submission, image uploads, and tender management.

## Tech Stack

- **Backend:** Express + TypeScript + Prisma + PostgreSQL (PostGIS)
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
- **Storage:** AWS S3 (with local upload fallback)
- **Auth:** JWT access + refresh tokens

## Quick Start (Docker)

```bash
# 1. Copy and configure environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# Edit backend/.env — set your JWT secrets and database URL
# Edit frontend/.env.local — set your API URL and Mapbox token

# 2. Start all services
docker compose up --build
```

The app will be available at `http://localhost:3000`.

## Manual Setup

### Prerequisites

- Node.js 22+
- PostgreSQL 16+ with PostGIS extension
- npm

### Backend

```bash
cd backend
cp .env.example .env   # Edit with your config
npm install
npx prisma migrate dev
npm run dev
```

### Frontend

```bash
cd frontend
cp .env.example .env.local   # Edit with your config
npm install
npm run dev
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `AWS_REGION` | AWS region for S3 |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `S3_BUCKET_NAME` | S3 bucket for image uploads |
| `ML_WEBHOOK_SECRET` | Secret for ML service webhook |
| `FRONTEND_URL` | Frontend origin for CORS |
| `PORT` | Backend port (default: 4000) |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox access token |

## API

The backend serves a REST API at `/api/v1/`. Key endpoints:

- `POST /api/v1/auth/register` — Register a new user
- `POST /api/v1/auth/login` — Login
- `POST /api/v1/auth/refresh` — Refresh access token
- `POST /api/v1/auth/logout` — Logout
- `GET /api/v1/reports` — List pothole reports
- `POST /api/v1/reports` — Submit a pothole report
- `GET /api/health` — Health check
