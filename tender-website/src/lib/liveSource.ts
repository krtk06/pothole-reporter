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
    "http://localhost:4000";
  return raw.replace(/\/+$/, "");
}

/**
 * Pulls the live tender feed from the backend's public endpoint
 * (GET /api/v1/public/tenders). The backend builds it straight from
 * Postgres + AWS S3 with freshly-minted presigned evidence URLs, so this
 * is the real-time source. Short timeout so the portal stays snappy and
 * falls back to the local sync cache when the backend is unreachable.
 */
export async function fetchLiveTenders(timeoutMs = 8000): Promise<LiveFetchResult> {
  const url = `${backendBaseUrl()}/api/v1/public/tenders`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return { ok: false, tenders: [], fetchedAt: null, error: `backend status ${res.status}` };
    }
    const data = await res.json().catch(() => null);
    const tenders = Array.isArray(data?.tenders) ? (data.tenders as TenderItem[]) : [];
    return { ok: true, tenders, fetchedAt: data?.last_sync_at || new Date().toISOString() };
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
