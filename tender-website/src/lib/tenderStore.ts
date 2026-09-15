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

// No dummy/seed data: the portal starts empty and only shows real tenders
// received via POST /api/sync from the Pothole Reporter backend
// (Postgres + AWS S3 presigned evidence URLs). When nothing has been synced
// yet — or every tender was withdrawn — the UI shows "No Tenders Available".
const EMPTY_STORE: TenderStoreData = {
  lastSyncAt: null,
  syncLogs: [],
  bids: [],
  tenders: [],
};

/** IDs / markers that only ever appear in local dummy/test fixtures. */
const DUMMY_TENDER_IDS = new Set([
  "tender-vskp-01",
  "tender-ntr-02",
  "tender-tpt-03",
  "tender-test-101",
  "bid-101",
  "sync-init-001",
]);

function isDummyPothole(p: Pothole): boolean {
  if (!p) return false;
  if (p.image_url && p.image_url.includes("unsplash.com")) return true;
  if (typeof p.id === "string" && (p.id.startsWith("pot-") || p.id.startsWith("pot-test"))) return true;
  const notes = (p.address_notes || "").toLowerCase();
  const reporter = (p.reporter_name || "").toLowerCase();
  // Local test fixtures pushed during development ("Threshold test pothole N",
  // "Below-threshold pothole N", reporter "Test Reporter", keys th-test-*.jpg)
  if (reporter === "test reporter" && (notes.includes("threshold") || notes.includes("test"))) return true;
  const key = (p.image_s3_key || "").toLowerCase();
  if (key.includes("th-test-") || key.includes("below-th-")) return true;
  return false;
}

function isDummyTender(t: TenderItem): boolean {
  if (!t) return false;
  if (DUMMY_TENDER_IDS.has(t.id)) return true;
  if (typeof t.id === "string" && t.id.startsWith("tender-test-")) return true;
  if ((t.potholes || []).length > 0 && t.potholes.every(isDummyPothole)) {
    // A tender whose entire evidence set is dummy/test fixtures is dummy.
    // Real synced tenders carry real S3 keys and reporter names.
    const notes = `${t.title || ""} ${t.description || ""}`.toLowerCase();
    if (t.block_id?.includes("visakhapatnam/gajuwaka") && notes.includes("gajuwaka industrial")) return true;
    if (t.block_id?.includes("vijayawada urban") && notes.includes("benz circle")) return true;
    if (t.block_id?.includes("tirupati urban") && notes.includes("alipiri")) return true;
    if (t.block_id?.includes("mvp colony")) return true;
    return true;
  }
  if (t.potholes?.some((p) => p.image_url?.includes("unsplash.com"))) return true;
  return false;
}

/** Strip any legacy dummy/test records from a loaded store. Returns true if cleaned. */
function purgeDummyRecords(store: TenderStoreData): boolean {
  const beforeTenders = store.tenders.length;
  const beforeBids = store.bids.length;
  store.tenders = (store.tenders || []).filter((t) => !isDummyTender(t));
  // Drop bids attached to removed tenders + the known dummy bid fixture
  const liveIds = new Set(store.tenders.map((t) => t.id));
  store.bids = (store.bids || []).filter(
    (b) => !DUMMY_TENDER_IDS.has(b.id) && liveIds.has(b.tender_id)
  );
  // Within surviving real tenders, drop individual dummy pothole fixtures
  for (const t of store.tenders) {
    if (t.potholes?.some(isDummyPothole)) {
      t.potholes = t.potholes.filter((p) => !isDummyPothole(p));
      t.pothole_count = t.potholes.length;
    }
  }
  return store.tenders.length !== beforeTenders || store.bids.length !== beforeBids;
}

function ensureDataFile(): TenderStoreData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    // Start empty — no dummy tenders. Real data arrives via POST /api/sync.
    const fresh: TenderStoreData = { ...EMPTY_STORE, syncLogs: [], bids: [], tenders: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(fresh, null, 2), "utf-8");
    return fresh;
  }

  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    const store: TenderStoreData = {
      lastSyncAt: parsed.lastSyncAt ?? null,
      syncLogs: Array.isArray(parsed.syncLogs) ? parsed.syncLogs : [],
      bids: Array.isArray(parsed.bids) ? parsed.bids : [],
      tenders: Array.isArray(parsed.tenders) ? parsed.tenders : [],
    };
    // Heal legacy files: strip dummy/test fixtures once, then persist.
    if (purgeDummyRecords(store)) {
      try {
        saveData(store);
      } catch {
        /* best-effort */
      }
    }
    return store;
  } catch {
    return { ...EMPTY_STORE, syncLogs: [], bids: [], tenders: [] };
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

/**
 * Quietly refreshes the local cache with a live snapshot (no sync-log spam).
 * Used by GET /api/tenders so the offline fallback stays fresh. Real syncs
 * via POST /api/sync still write full log entries and lastSyncAt.
 */
export function cacheLiveTenders(liveTenders: TenderItem[]): { cached: number } {
  const store = ensureDataFile();
  const clean = (Array.isArray(liveTenders) ? liveTenders : []).filter(
    (t) => t && !isDummyTender(t)
  );
  const liveIds = new Set(clean.map((t) => t.id));
  store.tenders = clean;
  store.bids = (store.bids || []).filter(
    (b) => !DUMMY_TENDER_IDS.has(b.id) && liveIds.has(b.tender_id)
  );
  saveData(store);
  return { cached: clean.length };
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
