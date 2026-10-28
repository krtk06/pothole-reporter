import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../types";
import { isAdminScope } from "./auth";

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden: admin access required" });
    return;
  }
  // A legacy or malformed admin row must fail closed, not become state-wide.
  if (!isAdminScope(req.user.admin_scope)) {
    res.status(403).json({ error: "Forbidden: admin jurisdiction is not configured" });
    return;
  }
  next();
}

export function requireStateAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user || req.user.role !== "admin" || req.user.admin_scope !== "state") {
    res.status(403).json({ error: "Forbidden: state-level admin access required" });
    return;
  }
  next();
}
