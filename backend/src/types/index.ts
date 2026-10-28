import { Request } from "express";

export type AdminScope = "mandal" | "district" | "state";

export interface AuthPayload {
  userId: string;
  role: "public" | "admin";
  sid: string;
  admin_scope?: AdminScope;
  admin_state?: string;
  admin_district?: string;
  admin_mandal?: string;
  sessionVersion?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}

export function requestContext(req: Request) {
  return {
    userAgent: req.header("user-agent")?.slice(0, 512) || null,
    ipAddress: req.ip?.slice(0, 64) || null,
  };
}
