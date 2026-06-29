import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import prisma from "../config/database";
import logger from "../config/logger";
import { sendPasswordResetEmail } from "./emailService";
import { AuthPayload } from "../types";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateAccessToken(payload: AuthPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  const expiresIn = process.env.JWT_EXPIRES_IN || "1h";
  const opts: SignOptions = { expiresIn: expiresIn as any, algorithm: "HS256" };
  return jwt.sign(payload, secret, opts);
}

function generateRefreshToken(payload: AuthPayload): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET is not configured");
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
  const opts: SignOptions = { expiresIn: expiresIn as any, algorithm: "HS256" };
  return jwt.sign(payload, secret, opts);
}

export async function registerUser(name: string, email: string, password: string, phone?: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("Invalid email or password");
  }

  const password_hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { name, email, phone, password_hash },
  });

  const payload: AuthPayload = { userId: user.id, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await prisma.user.update({
    where: { id: user.id },
    data: { refresh_token: hashToken(refreshToken) },
  });

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, theme_preference: user.theme_preference },
    accessToken,
    refreshToken,
  };
}

export async function loginUser(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error("Invalid email or password");
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw new Error("Invalid email or password");
  }

  const payload: AuthPayload = { userId: user.id, role: user.role };
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await prisma.user.update({
    where: { id: user.id },
    data: { refresh_token: hashToken(refreshToken) },
  });

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, theme_preference: user.theme_preference },
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(token: string) {
  try {
    const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
    if (!REFRESH_SECRET) throw new Error("JWT_REFRESH_SECRET is not configured");
    const decoded = jwt.verify(token, REFRESH_SECRET) as AuthPayload;
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.refresh_token !== hashToken(token)) {
      throw new Error("Invalid refresh token");
    }

    const payload: AuthPayload = { userId: user.id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    await prisma.user.update({
      where: { id: user.id },
      data: { refresh_token: hashToken(newRefreshToken) },
    });

    return { accessToken, refreshToken: newRefreshToken };
  } catch {
    throw new Error("Invalid or expired refresh token");
  }
}

export async function logoutUser(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { refresh_token: null },
  });
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return;
  }

  const secret = process.env.JWT_RESET_SECRET;
  if (!secret) throw new Error("JWT_RESET_SECRET is not configured");
  const payload = { userId: user.id, purpose: "password_reset" } as const;
  const token = jwt.sign(payload, secret, { expiresIn: "15m", algorithm: "HS256" } as SignOptions);

  const resetLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${token}`;

  logger.info({ email, resetLink }, "Password reset link generated");

  await sendPasswordResetEmail(user.email, resetLink);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const secret = process.env.JWT_RESET_SECRET;
  if (!secret) throw new Error("JWT_RESET_SECRET is not configured");

  let decoded: { userId: string; purpose: string };
  try {
    decoded = jwt.verify(token, secret) as typeof decoded;
  } catch {
    throw new Error("Invalid or expired reset token");
  }

  if (decoded.purpose !== "password_reset") {
    throw new Error("Invalid reset token");
  }

  const password_hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: decoded.userId },
    data: { password_hash, refresh_token: null },
  });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    theme_preference: user.theme_preference,
  };
}
