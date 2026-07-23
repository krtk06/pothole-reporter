import { Request } from "express";

export type AdminScope = "mandal" | "district" | "state";

export interface AuthPayload {
  userId: string;
  role: "public" | "admin";
  admin_scope?: AdminScope;
  admin_state?: string;
  admin_district?: string;
  admin_mandal?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}
