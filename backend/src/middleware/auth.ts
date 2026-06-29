import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest, AuthPayload } from "../types";

function verifyToken(token: string, secret: string): AuthPayload | null {
  try {
    return jwt.verify(token, secret, { algorithms: ["HS256"] }) as AuthPayload;
  } catch {
    return null;
  }
}

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    res.status(500).json({ error: "Server misconfiguration" });
    return;
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token, JWT_SECRET);
    if (decoded) {
      req.user = decoded;
      next();
      return;
    }
  }

  const cookieToken = req.cookies?.accessToken;
  if (cookieToken) {
    const decoded = verifyToken(cookieToken, JWT_SECRET);
    if (decoded) {
      req.user = decoded;
      next();
      return;
    }
  }

  res.status(401).json({ error: "Invalid or expired token" });
}
