import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest, AuthPayload, AdminScope } from "../types";
import prisma from "../config/database";
import { resolveAdminScope } from "../services/authService";

function verifyAccessToken(token: string): AuthPayload | null {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    return jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "pothole-reporter",
      audience: "pothole-reporter-web",
    }) as AuthPayload;
  } catch {
    return null;
  }
}

function tokenFromRequest(req: AuthenticatedRequest): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) return authHeader.slice("Bearer ".length);
  if (req.cookies?.accessToken) return req.cookies.accessToken;
  return null;
}

/**
 * Authenticate an access token and re-check the server-side session.
 *
 * The session check is what makes admin single-device login real: when an admin
 * signs in elsewhere, the previous session row is revoked and its still-valid
 * access token stops working immediately.
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = tokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: "Invalid, expired, or superseded session" });
    return;
  }

  const decoded = verifyAccessToken(token);
  if (!decoded?.sid) {
    res.status(401).json({ error: "Invalid, expired, or superseded session" });
    return;
  }

  try {
    const session = await prisma.userSession.findUnique({
      where: { id: decoded.sid },
      include: { user: true },
    });

    if (!session || session.revoked_at || session.expires_at <= new Date()) {
      res.status(401).json({ error: "Invalid, expired, or superseded session" });
      return;
    }

    const user = session.user;
    const payload: AuthPayload = {
      userId: user.id,
      role: user.role,
      sid: session.id,
    };

    if (user.role === "admin") {
      const scope = resolveAdminScope(user);
      if (scope) payload.admin_scope = scope;
      if (user.state) payload.admin_state = user.state;
      if (user.district) payload.admin_district = user.district;
      if (user.locality) payload.admin_mandal = user.locality;
    }

    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid, expired, or superseded session" });
  }
}

export function isAdminScope(value: unknown): value is AdminScope {
  return value === "state" || value === "district" || value === "mandal";
}
