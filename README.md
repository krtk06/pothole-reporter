# Pothole Reporter

A full-stack pothole reporting application with map-based submission, image uploads, and tender management.

## Tech Stack

- **Backend:** Express + TypeScript + Prisma + PostgreSQL (PostGIS on Supabase)
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
- **Mobile:** Expo + React Native
- **Database:** Supabase PostgreSQL with PostGIS
- **Storage:** AWS S3 with local upload fallback
- **Auth:** JWT access tokens, refresh tokens, and one-time password reset tokens

## Prerequisites

- Node.js 22+
- npm
- A Supabase project

## Local Setup

### 1. Supabase Database

1. Create a Supabase project.
2. Copy the direct PostgreSQL connection string from project settings.
3. Enable PostGIS in the Supabase SQL editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

Edit `backend/.env` before starting:
- Set `DATABASE_URL` to your Supabase connection string.
- Generate unique values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `JWT_RESET_SECRET`.
- Configure AWS S3 and SES variables if you want cloud uploads and password reset email.

The backend starts on `http://localhost:4000`.

### 3. Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The frontend starts on `http://localhost:3000`.

### 4. Mobile

```bash
cd mobile
cp .env.example .env
npm install
npx expo start
```

For a physical device, set `EXPO_PUBLIC_API_URL` to a reachable backend URL instead of `localhost`.

## Deploying Without Docker

This project does not use Docker. Create separate Railway services for the backend and frontend and configure them in the Railway dashboard.

### Backend Railway Service

- Root directory: `backend`
- Build command: `npm ci && npx prisma generate && npm run build`
- Start command: `npx prisma migrate deploy && npm start`
- Required environment variables: all variables listed in `backend/.env.example`

### Frontend Railway Service

- Root directory: `frontend`
- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Required environment variable: `NEXT_PUBLIC_API_URL=https://your-backend-url/api/v1`

### Mobile Deployment

Do not deploy the mobile app to Railway. Use Expo/EAS for mobile builds and set:

```bash
EXPO_PUBLIC_API_URL=https://your-backend-url/api/v1
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `JWT_RESET_SECRET` | Secret used to hash password reset tokens |
| `AWS_REGION` | AWS region for S3 and SES |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `S3_BUCKET_NAME` | S3 bucket for image uploads |
| `ML_WEBHOOK_SECRET` | Secret for ML service webhook |
| `FRONTEND_URL` | Frontend origin for CORS and reset links |
| `PORT` | Backend port, default `4000` |
| `SES_FROM_EMAIL` | Email sender address for password resets |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL, for example `http://localhost:4000/api/v1` |

### Mobile (`mobile/.env`)

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend API base URL reachable from the mobile device |

## API

The backend serves a REST API at `/api/v1/`.

- `POST /api/v1/auth/register` - Register a new user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout
- `POST /api/v1/auth/forgot-password` - Request a one-time password reset link
- `POST /api/v1/auth/reset-password` - Reset password with a valid one-time token
- `GET /api/v1/reports` - List pothole reports
- `POST /api/v1/reports` - Submit a pothole report
- `GET /api/health` - Health check
