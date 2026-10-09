import jwt, { SignOptions } from "jsonwebtoken";

/**
 * Test secrets. These are assigned to process.env at module-evaluation time so
 * they are present before any route/service module that reads them is imported
 * (tenderService reads POTHOLE_TENDER_THRESHOLD once, at module load).
 */
export const JWT_SECRET = "test-jwt-secret";
export const JWT_REFRESH_SECRET = "test-jwt-refresh-secret";
export const JWT_RESET_SECRET = "test-reset-secret";

process.env.JWT_SECRET = JWT_SECRET;
process.env.JWT_REFRESH_SECRET = JWT_REFRESH_SECRET;
process.env.JWT_RESET_SECRET = JWT_RESET_SECRET;
process.env.JWT_EXPIRES_IN = "1h";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.FRONTEND_URL = "http://localhost:3000";

export const ADMIN_ID = "11111111-1111-4111-8111-111111111111";

export type Scope = "state" | "district" | "mandal";

export interface ScopeClaims {
  role: "admin" | "public";
  admin_scope?: Scope;
  admin_state?: string;
  admin_district?: string;
  admin_mandal?: string;
}

/** Access token with the same claim shape authService.buildPayload() produces. */
export function mintAccessToken(claims: Partial<ScopeClaims> = {}): string {
  const payload = {
    userId: ADMIN_ID,
    role: claims.role ?? "admin",
    ...(claims.admin_scope ? { admin_scope: claims.admin_scope } : {}),
    ...(claims.admin_state ? { admin_state: claims.admin_state } : {}),
    ...(claims.admin_district ? { admin_district: claims.admin_district } : {}),
    ...(claims.admin_mandal ? { admin_mandal: claims.admin_mandal } : {}),
  };
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "1h",
    algorithm: "HS256",
  } as SignOptions);
}

export function mintRefreshToken(userId: string = ADMIN_ID, role = "public"): string {
  return jwt.sign({ userId, role }, JWT_REFRESH_SECRET, {
    expiresIn: "7d",
    algorithm: "HS256",
  } as SignOptions);
}

export const STATE_ADMIN = {
  role: "admin" as const,
  admin_scope: "state" as const,
  admin_state: "Andhra Pradesh",
};

export const DISTRICT_ADMIN = {
  role: "admin" as const,
  admin_scope: "district" as const,
  admin_state: "Andhra Pradesh",
  admin_district: "Eluru",
};

export const MANDAL_ADMIN = {
  role: "admin" as const,
  admin_scope: "mandal" as const,
  admin_state: "Andhra Pradesh",
  admin_district: "Eluru",
  admin_mandal: "Addateegala",
};