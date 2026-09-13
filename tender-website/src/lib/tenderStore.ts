import fs from "fs";
import path from "path";

export interface Pothole {
  id: string;
  latitude: number;
  longitude: number;
  address_notes?: string | null;
  block_id?: string | null;
  status: string;
  image_url?: string | null;
  image_s3_key?: string | null;
  reporter_name?: string | null;
  created_at: string;
}

export interface TenderItem {
  id: string;
  block_id: string;
  district?: string;
  mandal?: string;
  title: string;
  description?: string;
  pothole_count: number;
  estimated_cost: number;
  status: "open" | "under_review" | "assigned" | "completed";
  generated_at: string;
  deadline?: string;
  potholes: Pothole[];
}

export interface ContractorBid {
  id: string;
  tender_id: string;
  contractor_name: string;
  company_name: string;
  license_number: string;
  email: string;
  phone: string;
  bid_amount: number;
  estimated_days: number;
  proposal_notes?: string;
  submitted_at: string;
}

export interface SyncLogEntry {
  id: string;
  received_at: string;
  potholes_count: number;
  tenders_count: number;
  source: string;
  triggered_by: string;
  status: "success" | "rejected";
  details?: string;
}

export interface TenderStoreData {
  tenders: TenderItem[];
  bids: ContractorBid[];
  syncLogs: SyncLogEntry[];
  lastSyncAt: string | null;
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "tenders.json");

const SEED_DATA: TenderStoreData = {
  lastSyncAt: "2026-09-08T14:30:00.000Z",
  syncLogs: [
    {
      id: "sync-init-001",
      received_at: "2026-09-08T14:30:00.000Z",
      potholes_count: 14,
      tenders_count: 3,
      source: "pothole-reporter",
      triggered_by: "scheduler",
      status: "success",
      details: "Initial baseline synchronization",
    },
  ],
  bids: [
    {
      id: "bid-101",
      tender_id: "tender-vskp-01",
      contractor_name: "Ramesh Naidu",
      company_name: "Apex Infrastructure & Roads Pvt Ltd",
      license_number: "AP-R&B-CL1-4892",
      email: "bids@apexinfra.in",
      phone: "+91 98480 12345",
      bid_amount: 320000,
      estimated_days: 14,
      proposal_notes: "Bituminous cold mix asphalt resurfacing with 2-year maintenance warranty.",
      submitted_at: "2026-09-09T09:15:00.000Z",
    },
  ],
  tenders: [
    {
      id: "tender-vskp-01",
      block_id: "andhra pradesh/visakhapatnam/gajuwaka",
      district: "Visakhapatnam",
      mandal: "Gajuwaka",
      title: "Gajuwaka Industrial Corridor Pothole Remediation Tender",
      description: "Comprehensive cold-mix bitumen patching and road stabilization across 6 critical road segments in Gajuwaka.",
      pothole_count: 6,
      estimated_cost: 360000,
      status: "open",
      generated_at: "2026-09-08T14:30:00.000Z",
      deadline: "2026-09-28T18:00:00.000Z",
      potholes: [
        {
          id: "pot-101",
          latitude: 17.6868,
          longitude: 83.2185,
          address_notes: "Deep crater near Gajuwaka junction on steel plant main road.",
          block_id: "andhra pradesh/visakhapatnam/gajuwaka",
          status: "verified",
          image_url: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80",
          reporter_name: "Suresh Kumar",
          created_at: "2026-09-07T11:20:00.000Z",
        },
        {
          id: "pot-102",
          latitude: 17.6912,
          longitude: 83.2241,
          address_notes: "Multiple road fissures opposite Old Bus Station.",
          block_id: "andhra pradesh/visakhapatnam/gajuwaka",
          status: "verified",
          image_url: "https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=600&q=80",
          reporter_name: "Priya V.",
          created_at: "2026-09-07T12:05:00.000Z",
        },
        {
          id: "pot-103",
          latitude: 17.6945,
          longitude: 83.2299,
          address_notes: "Edge breakage near Autonagar gate 2.",
          block_id: "andhra pradesh/visakhapatnam/gajuwaka",
          status: "verified",
          image_url: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80",
          reporter_name: "Anand M.",
          created_at: "2026-09-08T09:40:00.000Z",
        },
      ],
    },
    {
      id: "tender-ntr-02",
      block_id: "andhra pradesh/ntr/vijayawada urban",
      district: "NTR",
      mandal: "Vijayawada Urban",
      title: "MG Road & Benz Circle Arterial Repair Package",
      description: "Urgent resurfacing and pothole leveling across major transit arteries near Benz circle.",
      pothole_count: 5,
      estimated_cost: 450000,
      status: "open",
      generated_at: "2026-09-08T14:30:00.000Z",
      deadline: "2026-09-26T18:00:00.000Z",
      potholes: [
        {
          id: "pot-201",
          latitude: 16.5062,
          longitude: 80.648,
          address_notes: "Near flyover descent, 15cm depression causing traffic slowing.",
          block_id: "andhra pradesh/ntr/vijayawada urban",
          status: "verified",
          image_url: "https://images.unsplash.com/photo-1584463699039-445851f5038c?auto=format&fit=crop&w=600&q=80",
          reporter_name: "K. Mohan",
          created_at: "2026-09-06T15:10:00.000Z",
        },
        {
          id: "pot-202",
          latitude: 16.5098,
          longitude: 80.6515,
          address_notes: "Opposite municipal grounds, water logged cavity.",
          block_id: "andhra pradesh/ntr/vijayawada urban",
          status: "verified",
          image_url: "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&w=600&q=80",
          reporter_name: "Laxmi T.",
          created_at: "2026-09-07T08:30:00.000Z",
        },
      ],
    },
    {
      id: "tender-tpt-03",
      block_id: "andhra pradesh/tirupati/tirupati urban",
      district: "Tirupati",
      mandal: "Tirupati Urban",
      title: "Alipiri Bypass Road Safety & Repair Works",
      description: "High-priority pilgrimage access road repair and asphalt leveling.",
      pothole_count: 3,
      estimated_cost: 210000,
      status: "under_review",
      generated_at: "2026-09-08T14:30:00.000Z",
      deadline: "2026-09-22T18:00:00.000Z",
      potholes: [
        {
          id: "pot-301",
          latitude: 13.6288,
          longitude: 79.4192,
          address_notes: "Near Alipiri toll gate approach road.",
          block_id: "andhra pradesh/tirupati/tirupati urban",
          status: "verified",
          image_url: "https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=600&q=80",
          reporter_name: "Govind R.",
          created_at: "2026-09-08T10:15:00.000Z",
        },
      ],
    },
  ],
};

function ensureDataFile(): TenderStoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(SEED_DATA, null, 2), "utf-8");
    return SEED_DATA;
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return SEED_DATA;
  }
}

function saveData(data: TenderStoreData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function getTenderData(): TenderStoreData {
  return ensureDataFile();
}

export function parseBlockDistrictMandal(blockId?: string | null): { district: string; mandal: string } {
  if (!blockId) return { district: "General", mandal: "Central" };
  const parts = blockId.split("/");
  if (parts.length >= 3) {
    const cap = (s: string) => s.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    return { district: cap(parts[1]), mandal: cap(parts[2]) };
  } else if (parts.length === 2) {
    return { district: parts[1], mandal: "General" };
  }
  return { district: blockId, mandal: "Central" };
}

export function ingestSyncPayload(payload: any, source: string = "pothole-reporter"): {
  success: boolean;
  received_potholes: number;
  received_tenders: number;
} {
  const store = ensureDataFile();
  const incomingPotholes: Pothole[] = payload.potholes || [];
  const incomingTenders = payload.tenders || [];

  // Withdrawal reconciliation: tenders marked "rejected" by the backend were
  // withdrawn by an admin — remove them (and their bids) from the portal so a
  // failed direct DELETE call heals on the next scheduled sync.
  let withdrawnCount = 0;
  const upsertCandidates = incomingTenders.filter((incT: any) => {
    if (incT.status !== "rejected") return true;
    const before = store.tenders.length;
    store.tenders = store.tenders.filter(
      t => !(t.id === incT.id || (incT.block_id && t.block_id === incT.block_id))
    );
    if (store.tenders.length !== before) withdrawnCount += 1;
    return false;
  });
  const removedBids = withdrawnCount > 0
    ? store.bids.filter(b => !store.tenders.some(t => t.id === b.tender_id))
    : [];
  if (removedBids.length > 0) {
    store.bids = store.bids.filter(b => store.tenders.some(t => t.id === b.tender_id));
  }

  // Group incoming potholes by block_id
  const potholesByBlock = new Map<string, Pothole[]>();
  for (const p of incomingPotholes) {
    const blockKey = p.block_id || "unassigned";
    if (!potholesByBlock.has(blockKey)) {
      potholesByBlock.set(blockKey, []);
    }
    potholesByBlock.get(blockKey)!.push(p);
  }

  // Merge or create tenders
  const updatedTenders: TenderItem[] = [...store.tenders];

  for (const incT of upsertCandidates) {
    const existingIndex = updatedTenders.findIndex(t => t.id === incT.id || t.block_id === incT.block_id);
    const blockPotholes = potholesByBlock.get(incT.block_id) || [];
    const { district, mandal } = parseBlockDistrictMandal(incT.block_id);

    const tenderItem: TenderItem = {
      id: incT.id,
      block_id: incT.block_id,
      district,
      mandal,
      title: `${district} (${mandal}) Road Restoration Tender`,
      description: `Official road rehabilitation and pothole filling package for ${mandal} mandal, ${district} district.`,
      pothole_count: incT.pothole_count || blockPotholes.length,
      estimated_cost: incT.estimated_cost || (blockPotholes.length * 50000),
      status: (incT.status === "assigned" ? "assigned" : incT.status === "completed" ? "completed" : "open") as any,
      generated_at: incT.generated_at || new Date().toISOString(),
      deadline: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(),
      potholes: blockPotholes.length > 0 ? blockPotholes : (existingIndex >= 0 ? updatedTenders[existingIndex].potholes : []),
    };

    if (existingIndex >= 0) {
      updatedTenders[existingIndex] = {
        ...updatedTenders[existingIndex],
        ...tenderItem,
      };
    } else {
      updatedTenders.unshift(tenderItem);
    }
  }

  // If potholes exist without an explicit tender, create grouped tenders
  for (const [blockKey, pList] of Array.from(potholesByBlock.entries())) {
    const existing = updatedTenders.find(t => t.block_id === blockKey);
    if (!existing && pList.length > 0) {
      const { district, mandal } = parseBlockDistrictMandal(blockKey);
      updatedTenders.unshift({
        id: `tender-sync-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        block_id: blockKey,
        district,
        mandal,
        title: `${district} (${mandal}) Road Restoration Tender`,
        description: `Auto-generated tender package covering ${pList.length} verified potholes.`,
        pothole_count: pList.length,
        estimated_cost: pList.length * 60000,
        status: "open",
        generated_at: new Date().toISOString(),
        deadline: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        potholes: pList,
      });
    }
  }

  const logEntry: SyncLogEntry = {
    id: `sync-${Date.now()}`,
    received_at: new Date().toISOString(),
    potholes_count: incomingPotholes.length,
    tenders_count: incomingTenders.length,
    source,
    triggered_by: payload.triggered_by || "api-dispatch",
    status: "success",
    details: `Ingested ${incomingPotholes.length} potholes & ${upsertCandidates.length} tenders` +
      (withdrawnCount > 0 ? `; withdrew ${withdrawnCount} tender(s) and ${removedBids.length} bid(s)` : ""),
  };

  store.tenders = updatedTenders;
  store.syncLogs.unshift(logEntry);
  store.lastSyncAt = logEntry.received_at;

  saveData(store);

  return {
    success: true,
    received_potholes: incomingPotholes.length,
    received_tenders: incomingTenders.length,
  };
}

/**
 * Removes a tender (and its bids) from the portal. Used by the backend's
 * admin "unsend" flow: accepts a tender id or a block_id; at least one must
 * be provided.
 */
export function withdrawTender(params: {
  tender_id?: string;
  block_id?: string;
  triggered_by?: string;
}): { success: boolean; removed: number; message?: string } {
  if (!params.tender_id && !params.block_id) {
    return { success: false, removed: 0, message: "Provide 'tender_id' or 'block_id'." };
  }

  const store = ensureDataFile();

  const matches = store.tenders.filter(
    t => (params.tender_id && t.id === params.tender_id) ||
         (params.block_id && t.block_id === params.block_id)
  );

  if (matches.length === 0) {
    return { success: false, removed: 0, message: "No matching tender found." };
  }

  const removedBids = store.bids.filter(b => matches.some(t => t.id === b.tender_id));
  const removedPotholes = matches.reduce((sum, t) => sum + (t.potholes?.length || 0), 0);

  store.tenders = store.tenders.filter(t => !matches.includes(t));
  store.bids = store.bids.filter(b => !matches.some(t => t.id === b.tender_id));

  const logEntry: SyncLogEntry = {
    id: `withdraw-${Date.now()}`,
    received_at: new Date().toISOString(),
    potholes_count: removedPotholes,
    tenders_count: matches.length,
    source: "withdraw-api",
    triggered_by: params.triggered_by || "backend-withdraw",
    status: "rejected",
    details: `Withdrew tender(s) ${matches.map(t => t.id).join(", ")} and ${removedBids.length} bid(s) from the portal`,
  };
  store.syncLogs.unshift(logEntry);
  store.lastSyncAt = logEntry.received_at;

  saveData(store);

  return { success: true, removed: matches.length };
}

export function submitContractorBid(bid: Omit<ContractorBid, "id" | "submitted_at">): ContractorBid {
  const store = ensureDataFile();
  const newBid: ContractorBid = {
    ...bid,
    id: `bid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    submitted_at: new Date().toISOString(),
  };

  store.bids.unshift(newBid);

  // Mark tender under review if open
  const tender = store.tenders.find(t => t.id === bid.tender_id);
  if (tender && tender.status === "open") {
    tender.status = "under_review";
  }

  saveData(store);
  return newBid;
}
