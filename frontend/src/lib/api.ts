const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

class ApiClient {
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
        if (!retryRes.ok) throw new Error(await retryRes.text());
        return retryRes.json();
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Request failed");
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

  async register(name: string, email: string, password: string, phone?: string) {
    return this.fetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, phone }),
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
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Local upload failed");
    }
    return res.json();
  }

  async submitReport(s3Key: string, latitude: number, longitude: number, notes?: string) {
    return this.fetch("/reports", {
      method: "POST",
      body: JSON.stringify({ s3_key: s3Key, latitude, longitude, notes }),
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
}

export const api = new ApiClient();
