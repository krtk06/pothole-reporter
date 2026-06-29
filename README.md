# Pothole Reporter

A full-stack pothole reporting application with map-based submission, image uploads, and tender management.

## Tech Stack

- **Backend:** Express + TypeScript + Prisma + PostgreSQL (PostGIS on Supabase)
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
- **Database:** Supabase (managed PostgreSQL with PostGIS)
- **Storage:** AWS S3 (with local upload fallback)
- **Auth:** JWT access + refresh tokens

## Prerequisites

- Node.js 22+
- npm
- A [Supabase](https://supabase.com) project (free tier works)

## Setup

### 1. Supabase Database

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Go to **Project Settings → Database** and copy the connection string
3. Enable PostGIS — in your Supabase project, open the **SQL Editor** and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

### 2. Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
- Set `DATABASE_URL` to your Supabase connection string
- Generate three unique random strings for `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_RESET_SECRET`
- Configure your AWS credentials for S3 image uploads and SES email

```bash
npm install
npx prisma migrate dev
npm run dev
```

The backend starts on `http://localhost:4000`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The frontend starts on `http://localhost:3000`.

That's it — no Docker needed. Both services run directly on your machine and connect to Supabase for the database.

### Deploying (Railway)

If you want to deploy, Railway uses the Dockerfiles in `backend/` and `frontend/`:

```bash
# Railway reads railway.json which points to both Dockerfiles
# Just connect your GitHub repo to Railway — no manual setup needed
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `JWT_RESET_SECRET` | Secret for password reset tokens |
| `AWS_REGION` | AWS region for S3 |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `S3_BUCKET_NAME` | S3 bucket for image uploads |
| `ML_WEBHOOK_SECRET` | Secret for ML service webhook |
| `FRONTEND_URL` | Frontend origin for CORS |
| `PORT` | Backend port (default: 4000) |
| `SES_FROM_EMAIL` | Email sender address for password resets |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (default: http://localhost:4000/api/v1) |

## API

The backend serves a REST API at `/api/v1/`. Key endpoints:

- `POST /api/v1/auth/register` — Register a new user
- `POST /api/v1/auth/login` — Login
- `POST /api/v1/auth/refresh` — Refresh access token
- `POST /api/v1/auth/logout` — Logout
- `GET /api/v1/reports` — List pothole reports
- `POST /api/v1/reports` — Submit a pothole report
- `GET /api/health` — Health check
