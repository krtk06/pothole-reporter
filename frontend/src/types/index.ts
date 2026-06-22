export interface User {
  id: string;
  name: string;
  email: string;
  role: "public" | "admin";
  theme_preference: "light" | "dark";
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
  status: "open" | "assigned" | "completed";
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
