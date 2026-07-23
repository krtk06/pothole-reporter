import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import prisma from "../config/database";
import logger from "../config/logger";
import { sendPasswordResetEmail } from "./emailService";
import { AuthPayload, AdminScope } from "../types";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashResetToken(token: string): string {
  const secret = process.env.JWT_RESET_SECRET;
  if (!secret) throw new Error("JWT_RESET_SECRET is not configured");
  return crypto.createHash("sha256").update(`${token}.${secret}`).digest("hex");
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super("Invalid or expired refresh token");
  }
}

function buildPayload(user: any): AuthPayload {
  const payload: AuthPayload = { userId: user.id, role: user.role };
  if (user.admin_scope) payload.admin_scope = user.admin_scope as AdminScope;
  if (user.state) payload.admin_state = user.state;
  if (user.district) payload.admin_district = user.district;
  if (user.mandal) payload.admin_mandal = user.mandal;
  return payload;
}

function buildUserResponse(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    theme_preference: user.theme_preference,
    state: user.state ?? undefined,
    district: user.district ?? undefined,
    mandal: user.mandal ?? undefined,
    admin_scope: user.admin_scope ?? undefined,
  };
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

export async function registerUser(
  name: string,
  email: string,
  password: string,
  phone?: string,
  state?: string,
  district?: string,
  mandal?: string,
  admin_scope?: AdminScope
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("An account with this email already exists");
  }

  const password_hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone,
      password_hash,
      state: state || null,
      district: district || null,
      mandal: mandal || null,
      admin_scope: admin_scope || null,
    },
  });

  const payload = buildPayload(user);
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await prisma.user.update({
    where: { id: user.id },
    data: { refresh_token: hashToken(refreshToken) },
  });

  return {
    user: buildUserResponse(user),
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

  const payload = buildPayload(user);
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  await prisma.user.update({
    where: { id: user.id },
    data: { refresh_token: hashToken(refreshToken) },
  });

  return {
    user: buildUserResponse(user),
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(token: string) {
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!refreshSecret) throw new Error("JWT_REFRESH_SECRET is not configured");

  let decoded: AuthPayload;
  try {
    decoded = jwt.verify(token, refreshSecret) as AuthPayload;
  } catch {
    throw new InvalidRefreshTokenError();
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || user.refresh_token !== hashToken(token)) {
    throw new InvalidRefreshTokenError();
  }

  const payload = buildPayload(user);
  const accessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);

  await prisma.user.update({
    where: { id: user.id },
    data: { refresh_token: hashToken(newRefreshToken) },
  });

  return { accessToken, refreshToken: newRefreshToken };
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

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { user_id: user.id, used_at: null },
      data: { used_at: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    }),
  ]);

  const resetLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${token}`;

  logger.info({ email }, "Password reset link generated");
  await sendPasswordResetEmail(user.email, resetLink);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashResetToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token_hash: tokenHash },
  });

  if (!resetToken || resetToken.used_at || resetToken.expires_at <= new Date()) {
    throw new Error("Invalid or expired reset token");
  }

  const password_hash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.updateMany({
      where: {
        id: resetToken.id,
        used_at: null,
        expires_at: { gt: new Date() },
      },
      data: { used_at: new Date() },
    });

    if (consumed.count !== 1) {
      throw new Error("Invalid or expired reset token");
    }

    await tx.user.update({
      where: { id: resetToken.user_id },
      data: { password_hash, refresh_token: null },
    });
  });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  return buildUserResponse(user);
}
