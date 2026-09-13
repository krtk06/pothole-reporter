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
- Admin Dashboard: `http://localhost:3000/admin` (Sign in with admin credentials from `ADMIN_CREDENTIALS.md`)

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

> **Deployment note:** the Supabase schema was historically migrated by hand; run `npx prisma migrate deploy` (includes an idempotent reconciliation migration for `AdminScope`, the users jurisdiction columns and `TenderStatus.rejected`) when deploying.
