import { Request } from "express";

export interface AuthPayload {
  userId: string;
  role: "public" | "admin";
}

export interface AuthenticatedRequest extends Request {
  user?: AuthPayload;
}
