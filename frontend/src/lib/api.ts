import type { AdministrativeArea, AdministrativeAreaType, PublicPothole } from "@/types";
import { resolveViewport, viewportCentre } from "@/lib/locationBounds";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

class ApiClient {
  private async toApiError(res: Response): Promise<ApiError> {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    return new ApiError(err.error || "Request failed", res.status);
  }

  private async fetch(endpoint: string, options: RequestInit = {}) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      // Identifies this client to the API. The backend keys register/login
      // behaviour off the `mobile` value, so web must be explicit.
      "X-Client-Platform": "web",
      ...(options.headers as Record<string, string>),
    };

    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });

    if (res.status === 401) {
      const refreshed = await this.refresh();
      if (refreshed) {
        const retryRes = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers,
          credentials: "include",
        });
        if (!retryRes.ok) throw await this.toApiError(retryRes);
        return retryRes.json();
      }
    }

    if (!res.ok) {
      throw await this.toApiError(res);
    }

    return res.json();
  }

  private async refresh(): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getMe() {
    return this.fetch("/auth/me");
  }

  async register(
    name: string,
    email: string,
    password: string,
    phone?: string,
    state?: string,
    district?: string,
    mandal?: string,
    admin_scope?: "mandal" | "district" | "state"
  ) {
    return this.fetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, phone, state, district, mandal, admin_scope }),
    });
  }

  async login(email: string, password: string) {
    return this.fetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    try {
      return await this.fetch("/auth/logout", { method: "POST" });
    } catch {
      return null;
    }
  }

  async getPresignedUrl(filename: string, contentType: string) {
    return this.fetch("/uploads/presigned-url", {
      method: "POST",
      body: JSON.stringify({ filename, contentType }),
    });
  }

  async uploadLocal(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_URL}/uploads/local`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    if (!res.ok) {
      throw await this.toApiError(res);
    }
    return res.json();
  }

  async submitReport(s3Key: string, latitude: number, longitude: number, notes?: string, blockId?: string) {
    return this.fetch("/reports", {
      method: "POST",
      body: JSON.stringify({ s3_key: s3Key, latitude, longitude, notes, block_id: blockId }),
    });
  }

  async getMyReports() {
    return this.fetch("/reports");
  }

  async getAdminReports(status?: string) {
    const query = status ? `?status=${status}` : "";
    return this.fetch(`/admin/reports${query}`);
  }

  async getMapClusters() {
    return this.fetch("/admin/map-clusters");
  }

  async getTenders() {
    return this.fetch("/admin/tenders");
  }

  async updateTenderStatus(id: string, status: "open" | "assigned" | "completed" | "rejected") {
    return this.fetch(`/admin/tenders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  async withdrawTender(id: string) {
    return this.fetch(`/admin/tenders/${id}/withdraw`, {
      method: "POST",
    });
  }

  async getTenderSyncConfig() {
    return this.fetch("/admin/tender-sync");
  }

  async updateTenderSyncConfig(data: {
    target_url?: string;
    api_key?: string;
    sync_interval_days?: number;
    is_enabled?: boolean;
  }) {
    return this.fetch("/admin/tender-sync", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async triggerTenderSync() {
    return this.fetch("/admin/tender-sync/trigger", {
      method: "POST",
    });
  }

  async updateReportStatus(id: string, status: "pending" | "verified" | "rejected" | "fixed") {
    return this.fetch(`/admin/reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  }

  async getPublicPotholes(state?: string, district?: string, mandal?: string) {
    const params = new URLSearchParams();
    if (state) params.set("state", state);
    if (district) params.set("district", district);
    if (mandal) params.set("mandal", mandal);
    const query = params.toString() ? `?${params.toString()}` : "";
    return this.fetch(`/public/potholes${query}`);
  }

  async forgotPassword(email: string) {
    return this.fetch("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string) {
    return this.fetch("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
  }

  async getAdministrativeOptions(params: {
    level: Exclude<AdministrativeAreaType, "state">;
    q?: string;
    districtCode?: string;
    subdistrictCode?: string;
  }): Promise<{ areas: AdministrativeArea[] }> {
    const query = new URLSearchParams({ level: params.level });
    if (params.q) query.set("q", params.q);
    if (params.districtCode) query.set("districtCode", params.districtCode);
    if (params.subdistrictCode) query.set("subdistrictCode", params.subdistrictCode);
    const res: any = await this.fetch(`/map/areas/options?${query.toString()}`);
    // The API returns `options`; older builds returned `areas`. Reading only
    // `areas` silently yielded [] and sent the selector to its local
    // fallback directory on every load.
    res.areas = res.options ?? res.areas ?? [];
    return res;
  }

  async getCurrentAdministrativeArea(area: Pick<AdministrativeArea, "id" | "name" | "districtName" | "subdistrictName" | "districtCode" | "subdistrictCode"> | string): Promise<{ area: AdministrativeArea }> {
    // Resolved locally. `GET /map/areas/current` requires the caller to
    // already have latitude/longitude, so passing a village id returns 400 —
    // and the previous hardcoded fallback (15.91N, 79.74E) sat ~100km from
    // any real data, turning a failed lookup into an empty map instead of
    // an error. `india-locations.ts` supplies bounding boxes directly.
    const box =
      typeof area === "string"
        ? resolveViewport({})
        : resolveViewport({
            district: area.districtName,
            mandal: area.subdistrictName,
          });

    if (!box) {
      throw new Error("Unable to resolve a map viewport for the selected location");
    }

    const centre = viewportCentre(box);
    const name = typeof area === "string" ? area : area.name;
    const districtName = typeof area === "string" ? undefined : area.districtName;
    const subdistrictName = typeof area === "string" ? undefined : area.subdistrictName;

    return {
      area: {
        id: typeof area === "string" ? area : area.id,
        name,
        displayName: `${name}, ${subdistrictName || ""}, ${districtName || ""}, Andhra Pradesh, India`
          .replace(/,\s*,/g, ",")
          .replace(/^,\s*/, "")
          .trim(),
        type: subdistrictName ? "village" : "district",
        districtCode: typeof area === "string" ? undefined : area.districtCode,
        districtName,
        subdistrictCode: typeof area === "string" ? undefined : area.subdistrictCode,
        subdistrictName,
        stateName: "Andhra Pradesh",
        stateCode: "28",
        latitude: centre.latitude,
        longitude: centre.longitude,
        bbox: box,
        boundary: null,
      } as AdministrativeArea,
    };
  }

  async getPotholesInBounds(bbox: { west: number; south: number; east: number; north: number }): Promise<{ potholes: PublicPothole[] }> {
    try {
      const query = new URLSearchParams({
        bbox: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
      });
      return await this.fetch(`/map/potholes?${query.toString()}`);
    } catch {
      try {
        const query = new URLSearchParams({
          north: String(bbox.north),
          south: String(bbox.south),
          east: String(bbox.east),
          west: String(bbox.west),
        });
        const data = await this.fetch(`/map/reports?${query.toString()}`);
        return { potholes: data.reports || data.potholes || [] };
      } catch {
        return { potholes: [] };
      }
    }
  }
}

export const api = new ApiClient();
