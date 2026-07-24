import type { AdministrativeArea, AdministrativeAreaType, PublicPothole } from "@/types";

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
    return this.fetch(`/map/areas/options?${query.toString()}`);
  }

  async getCurrentAdministrativeArea(area: Pick<AdministrativeArea, "id" | "name" | "districtName" | "subdistrictName" | "districtCode" | "subdistrictCode"> | string): Promise<{ area: AdministrativeArea }> {
    const query = new URLSearchParams({ id: typeof area === "string" ? area : area.id });
    if (typeof area !== "string") {
      query.set("name", area.name);
      if (area.districtName) query.set("districtName", area.districtName);
      if (area.subdistrictName) query.set("subdistrictName", area.subdistrictName);
      if (area.districtCode) query.set("districtCode", area.districtCode);
      if (area.subdistrictCode) query.set("subdistrictCode", area.subdistrictCode);
    }
    return this.fetch(`/map/areas/current?${query.toString()}`);
  }

  async getPotholesInBounds(bbox: { west: number; south: number; east: number; north: number }): Promise<{ potholes: PublicPothole[] }> {
    const query = new URLSearchParams({
      bbox: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
    });
    return this.fetch(`/map/potholes?${query.toString()}`);
  }
}

export const api = new ApiClient();
