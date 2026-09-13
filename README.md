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
1. **Periodic Background Scheduler**:
   - The backend includes a background scheduler (`tenderScheduler.ts`) running continuously.
   - Automatically checks if the configured interval (15 to 30 days) has elapsed.
   - When due, it fetches all verified potholes, generates presigned S3 photo URLs, formats the tender packages, and dispatches the payload via HTTP POST to the Tender Website.
2. **API Key Authorization**:
   - Every dispatch includes the secret API key in the `X-API-Key` and `Authorization: Bearer <key>` headers.
   - The Tender Website validates the API key before accepting any payload, rejecting unauthorized requests with `401 Unauthorized`.
3. **Admin Management**:
   - Managed exclusively by administrators in the **Admin Dashboard** (`/admin` $\rightarrow$ **Tender Sync (15–30 Days)** tab).
   - Admins can:
     - Change the Tender Website URL
     - Rotate or generate the API key
     - Set the sync interval between **15 and 30 days**
     - Enable or disable automated periodic syncing
     - Trigger an instant manual sync ("Sync Now")
     - View the complete audit log of past transmissions
