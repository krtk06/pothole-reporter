# Pothole Reporter & Public Works Tendering System

A smart civic infrastructure platform comprising crowdsourced pothole detection, verification, automated tender generation, and an independent **Tender & Contractor Bidding Website** synchronized via an API key every 15 to 30 days (managed by administrators).

---

## 🏛️ System Architecture

```mermaid
flowchart LR
    Citizen["Citizen Mobile/Web App"] -->|Report Pothole & Photo| Backend["Pothole Reporter API\n(Port 4000)"]
    Admin["Admin Dashboard\n(/admin -> Tender Sync)"] -->|Set URL, Key, 15-30 Days| Backend
    
    subgraph PeriodicSync["Periodic Synchronization (15–30 Days)"]
        Backend -->|HTTP POST with X-API-Key\n(Potholes + Photos + GPS)| TenderAPI["Ingestion API\n(/api/sync)"]
    end

    subgraph TenderPortal["Tender Website (Port 3001)"]
        TenderAPI --> TenderStore[(Tender & Pothole Store)]
        TenderStore --> ContractorUI["Contractor & Public Portal\n- Tender Listings & Budgets\n- Leaflet GIS Pothole Map\n- Visual Photo Evidence\n- Contractor Bid Submission"]
    end
```

---

## 🚀 Running the Applications

### 1. Backend API (Port 4000)
```bash
cd backend
npm install
npm run dev
```

### 2. Main Frontend & Admin Portal (Port 3000)
```bash
cd frontend
npm install
npm run dev
```
- Citizen Dashboard: `http://localhost:3000/dashboard`
- Admin Dashboard: `http://localhost:3000/admin` (Sign in with an admin account — see *Admin Accounts* below)

### 3. Tendering Website (Port 3001)
```bash
cd tender-website
npm install
npm run dev
```
- Tender Portal UI: `http://localhost:3001`
- Ingestion API: `http://localhost:3001/api/sync`

---

## 🔑 Tender Integration & API Key Security

### How It Works:
1. **Immediate dispatch on threshold crossing**:
   - When the number of verified potholes in an area (block) reaches `POTHOLE_TENDER_THRESHOLD` (default 20), the backend creates a tender and **immediately** pushes the block's potholes (with presigned S3 photo URLs) plus the tender to the Tender Website (`POST /api/sync`).
2. **Scheduled sync for below-threshold areas**:
   - Blocks below the threshold are held back. A background scheduler (`tenderScheduler.ts`) checks hourly whether the configured interval (15 to 30 days) has elapsed; when due, `performTenderSync` dispatches all pending below-threshold potholes plus every tender for reconciliation.
   - Admins can also trigger an instant manual dispatch ("Sync Now") as an override; if they forget, the scheduler sends the data automatically within the interval.
3. **Unsend (withdraw)**:
   - Admins can withdraw an open tender from the **Tenders** tab. The tender is marked `rejected` (permanently excluded from future syncs) and removed from the Tender Website (`DELETE /api/tenders`).
   - Withdrawals are self-healing: every scheduled sync also removes tenders marked `rejected`, so a failed withdrawal dispatch heals automatically.
4. **API Key Authorization**:
   - The shared secret is configured via `TENDER_API_KEY` in both the backend `.env` and the Tender Website's `.env.local`; no key is hardcoded anywhere.
   - Every dispatch includes the secret API key in the `X-API-Key` and `Authorization: Bearer <key>` headers.
   - The Tender Website validates the API key before accepting any payload, rejecting unauthorized requests with `401 Unauthorized`.
5. **Admin Management (state-level admins only)**:
   - Managed in the **Admin Dashboard** (`/admin` → **Tender Sync (15–30 Days)** tab); mandal/district admins have no access to this configuration.
   - Admins can:
     - Change the Tender Website URL
     - Rotate or generate the API key
     - Set the sync interval between **15 and 30 days**
     - Enable or disable automated periodic syncing (threshold dispatches are always sent)
     - Trigger an instant manual sync ("Sync Now")
     - View the complete audit log of past transmissions

> **Deployment note:** the database is AWS RDS PostgreSQL with PostGIS. Apply schema changes only with `cd backend && npm run prisma:migrate` (= `prisma migrate deploy`). Never run `prisma db push` or `prisma migrate dev` against a real database: `potholes` and `administrative_areas` are deliberately absent from `schema.prisma`, so those commands would drop them.

---

## Admin Accounts

The system provisions **702 admin accounts**: 1 state-wide, 26 district, and 675 mandal.
The account list is committed as `admin-roster.csv` / `admin-roster.json`.
**These files contain no passwords.**

| Scope | Example account | Coverage |
| :--- | :--- | :--- |
| `state` | `admin@pothole.gov.in` | All 26 districts and 675 mandals |
| `district` | `admin.eluru@pothole.gov.in` | One district |
| `mandal` | `admin.addateegala.alluri.sitharama.raju@pothole.gov.in` | One mandal |

> **Passwords are not stored in this repository.** A readable directory containing
> plaintext credentials can be generated locally, is gitignored, and must never
> be committed or shared over chat:
>
> ```bash
> cd backend
> ADMIN_PASSWORD='<your password>' node src/scripts/generateCredentialsDoc.js
> ```
>
> Distribute credentials through a password manager or an encrypted channel, and
> rotate the password after use. The production deployment uses its own password,
> issued directly by the server administrator.

---

## AWS deployment

Everything runs in one AWS account. Nothing connects to a non-AWS database host. The backend refuses to start unless `DATABASE_URL` points at an RDS endpoint (`backend/src/config/databaseTarget.ts`).

| Concern | Service | Used by |
| :--- | :--- | :--- |
| Users, reports, tenders, areas | RDS PostgreSQL with PostGIS | backend |
| Pothole evidence photos | S3 bucket `pothole-evidence-storage-john` (us-east-1) | backend (presigned URLs) |
| Tender and bid store | S3 bucket `pothole-bucket-1`, key `tender-portal/tenders.json` | tender website |
| Password-reset email | SES (not configured) | backend. Reset emails are not sent until SES is set up. |

**Development database.** Use a separate database on the same instance, so local testing cannot touch production data:

```sql
CREATE DATABASE pothole_dev;
```

Point `DATABASE_URL` in `backend/.env` at it. The migrations enable PostGIS themselves.

**Credentials.** Give the backend and the tender website separate IAM users:

- Backend: `s3:GetObject` and `s3:PutObject` on `pothole-evidence-storage-john/*`, plus `ses:SendEmail` if SES is enabled.
- Tender website: `s3:GetObject` and `s3:PutObject` on `pothole-bucket-1/tender-portal/*`. It must be able to write, because bids are saved back to S3.

**Verify a deployment** from a machine that can reach RDS:

```bash
cd backend && npm run verify:deploy
```

