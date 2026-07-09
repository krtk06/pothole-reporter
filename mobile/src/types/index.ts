export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'public' | 'admin';
  theme_preference?: 'light' | 'dark';
}

export interface PotholeReport {
  id: string;
  reporter_id?: string;
  image_s3_key?: string;
  latitude: number;
  longitude: number;
  address_notes?: string;
  block_id?: string;
  status: 'pending' | 'verified' | 'rejected' | 'fixed';
  created_at: string;
  reporter_name?: string;
}

export interface Tender {
  id: string;
  block_id: string;
  pothole_count: number;
  estimated_cost: number;
  status: 'open' | 'assigned' | 'completed';
  generated_at: string;
}

export interface MapCluster {
  block_id: string;
  avg_latitude: number;
  avg_longitude: number;
  count: number;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}
