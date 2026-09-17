import type { TenderItem } from "./tenderStore";

export interface LiveFetchResult {
  ok: boolean;
  tenders: TenderItem[];
  fetchedAt: string | null;
  error?: string;
}

function backendBaseUrl(): string {
  const raw =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://32.199.22.201:4000";
  return raw.replace(/\/+$/, "");
}

/**
 * Pulls the live tender feed from the backend's public endpoint
 * (GET /api/v1/public/tenders or GET /api/v1/map/reports). The backend builds it straight from
 * Postgres + AWS S3 with freshly-minted presigned evidence URLs, so this
 * is the real-time source. Short timeout so the portal stays snappy and
 * falls back to the local sync cache when the backend is unreachable.
 */
export async function fetchLiveTenders(timeoutMs = 8000): Promise<LiveFetchResult> {
  const baseUrl = backendBaseUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}/api/v1/public/tenders`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      const tenders = Array.isArray(data?.tenders) ? (data.tenders as TenderItem[]) : [];
      return { ok: true, tenders, fetchedAt: data?.last_sync_at || new Date().toISOString() };
    }

    // Fallback: check live /api/v1/map/reports on AWS EC2
    const mapRes = await fetch(`${baseUrl}/api/v1/map/reports?south=10&north=30&west=70&east=90`, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (mapRes.ok) {
      const mapData = await mapRes.json().catch(() => null);
      const reports = Array.isArray(mapData?.reports) ? mapData.reports : [];
      if (reports.length > 0) {
        const liveTender: TenderItem = {
          id: "tndr-live-ap-cluster",
          block_id: "AP-RDS-01",
          district: "Guntur",
          mandal: "Guntur",
          title: "Municipal Road Repair & Pothole Rectification - Active AWS Cluster",
          description: "Live cluster synthesized from active AWS PostGIS database road issue reports.",
          pothole_count: reports.length,
          estimated_cost: reports.length * 15000,
          status: "open",
          generated_at: mapData?.lastTenderedAt || new Date().toISOString(),
          deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          potholes: reports.map((r: any) => ({
            id: r.id,
            latitude: Number(r.latitude),
            longitude: Number(r.longitude),
            status: r.status || "active",
            image_s3_key: r.image_s3_key || null,
            image_url: r.image_s3_key ? `${baseUrl}/${r.image_s3_key.replace(/^uploads\//, "uploads/")}` : null,
            address_notes: r.condition ? `Condition: ${r.condition} (Severity: ${r.severity_score || 'N/A'})` : "Active road defect",
            created_at: r.created_at || new Date().toISOString(),
          })),
        };
        return { ok: true, tenders: [liveTender], fetchedAt: mapData?.lastTenderedAt || new Date().toISOString() };
      }
    }

    return { ok: false, tenders: [], fetchedAt: null, error: `backend status ${res.status}` };
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "backend timeout" : err?.message || "backend unreachable";
    return { ok: false, tenders: [], fetchedAt: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * AWS presigned URLs expire (~15 min). A cached URL past its expiry would
 * render as a broken image, so detect expiry from the X-Amz-Date /
 * X-Amz-Expires query params. Returns true when the URL is expired.
 */
export function isPresignedUrlExpired(imageUrl?: string | null): boolean {
  if (!imageUrl) return false;
  if (!imageUrl.includes("X-Amz-")) return false; // not a presigned URL
  try {
    const u = new URL(imageUrl);
    const dateStr = u.searchParams.get("X-Amz-Date");
    const expiresSec = Number(u.searchParams.get("X-Amz-Expires") || "900");
    if (!dateStr || Number.isNaN(expiresSec)) return true;
    // X-Amz-Date format: YYYYMMDDTHHMMSSZ
    const m = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    if (!m) return true;
    const issued = Date.parse(
      `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`
    );
    if (Number.isNaN(issued)) return true;
    return Date.now() > issued + expiresSec * 1000;
  } catch {
    return true;
  }
}

/**
 * Sanitizes tenders for display: expired AWS presigned URLs are nulled
 * (keeping image_s3_key so the next live refresh restores them) instead of
 * serving broken images.
 */
export function sanitizeTenders(tenders: TenderItem[]): TenderItem[] {
  return (tenders || []).map((t) => ({
    ...t,
    potholes: (t.potholes || []).map((p) => ({
      ...p,
      image_url: isPresignedUrlExpired(p.image_url) ? null : p.image_url,
    })),
  }));
}
