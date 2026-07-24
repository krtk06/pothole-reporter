export type AdminScope = "mandal" | "district" | "state";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "public" | "admin";
  is_guest?: boolean;
  theme_preference: "light" | "dark";
  state?: string;
  district?: string;
  mandal?: string;
  admin_scope?: AdminScope;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface Report {
  id: string;
  image_s3_key: string;
  image_url?: string;
  longitude: number;
  latitude: number;
  address_notes?: string;
  status: "pending" | "verified" | "rejected" | "fixed";
  block_id?: string;
  created_at: string;
}

export interface Tender {
  id: string;
  block_id: string;
  pothole_count: number;
  estimated_cost: number;
  status: "open" | "assigned" | "completed" | "rejected";
  generated_at: string;
}

export interface AdminReport extends Report {
  reporter_name: string;
  reporter_phone: string;
}

export interface MapCluster {
  block_id: string;
  count: number;
  avg_longitude: number;
  avg_latitude: number;
}

export interface PublicPothole {
  id: string;
  latitude: number;
  longitude: number;
  status: "pending" | "verified" | "rejected" | "fixed";
  block_id?: string;
  created_at: string;
}

export interface MapBoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type AdministrativeAreaType = "state" | "district" | "subdistrict" | "village";

export interface AdministrativeArea {
  id: string;
  name: string;
  displayName: string;
  type: AdministrativeAreaType;
  stateCode?: string;
  stateName?: string;
  districtCode?: string;
  districtName?: string;
  subdistrictCode?: string;
  subdistrictName?: string;
  latitude?: number | null;
  longitude?: number | null;
  bbox?: MapBoundingBox | null;
  boundary?: unknown | null;
}
