import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import prisma from "../config/database";
import logger from "../config/logger";
import { sendPasswordResetEmail } from "./emailService";
import { AdminScope, AuthPayload } from "../types";

const BCRYPT_ROUNDS = 12;

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashResetToken(token: string): string {
  const secret = process.env.JWT_RESET_SECRET;
  if (!secret) throw new Error("JWT_RESET_SECRET is not configured");
  return crypto.createHash("sha256").update(`${token}.${secret}`).digest("hex");
}

function durationToMs(value: string, fallbackMs: number): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) return fallbackMs;
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return amount * multiplier;
}

function refreshTokenExpiry(): Date {
  return new Date(
    Date.now() + durationToMs(process.env.JWT_REFRESH_EXPIRES_IN || "7d", 7 * 86_400_000),
  );
}

export class InvalidRefreshTokenError extends Error {
  constructor() {
    super("Invalid or expired refresh token");
  }
}

export interface SessionContext {
  userAgent?: string | null;
  ipAddress?: string | null;
}

interface UserLike {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  state: string | null;
  district: string | null;
  locality: string | null;
  admin_scope: string | null;
  role: string;
  theme_preference: string;
}

function inferScope(user: Pick<UserLike, "district" | "locality">): AdminScope | null {
  const district = user.district?.trim();
  const locality = user.locality?.trim();
  if (district && locality) return "mandal";
  if (district) return "district";
  if (!district && !locality) return "state";
  return null;
}

export function resolveAdminScope(user: Pick<UserLike, "admin_scope" | "district" | "locality">): AdminScope | null {
  const value = (user.admin_scope || "").trim() as AdminScope;
  const hasDistrict = Boolean(user.district?.trim());
  const hasLocality = Boolean(user.locality?.trim());

  // An explicit scope must agree with the jurisdiction fields. A corrupted row
  // must fail closed rather than become state-wide.
  if (value === "state") return !hasDistrict && !hasLocality ? "state" : null;
  if (value === "district") return hasDistrict && !hasLocality ? "district" : null;
  if (value === "mandal") return hasDistrict && hasLocality ? "mandal" : null;
  return inferScope(user);
}

function scopeOf(user: UserLike): AdminScope | null {
  return resolveAdminScope(user);
}

export function publicUser(user: UserLike) {
  const scope = user.role === "admin" ? scopeOf(user) : null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    state: user.state,
    district: user.district,
    // `locality` is the live DB column; `mandal` is the public API field.
    mandal: user.locality,
    locality: user.locality,
    role: user.role,
    theme_preference: user.theme_preference,
    admin_scope: scope,
  };
}

function buildPayload(user: UserLike, sid: string): AuthPayload {
  const payload: AuthPayload = {
    userId: user.id,
    role: user.role as "public" | "admin",
    sid,
    sessionVersion: undefined,
  };
  if (user.role === "admin") {
    const scope = scopeOf(user);
    if (scope) payload.admin_scope = scope;
    if (user.state) payload.admin_state = user.state;
    if (user.district) payload.admin_district = user.district;
    if (user.locality) payload.admin_mandal = user.locality;
  }
  return payload;
}

function signAccessToken(payload: AuthPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  const expiresIn = process.env.JWT_EXPIRES_IN || "1h";
  const opts: SignOptions = {
    expiresIn: expiresIn as any,
    algorithm: "HS256",
    jwtid: crypto.randomUUID(),
    issuer: "pothole-reporter",
    audience: "pothole-reporter-web",
  };
  return jwt.sign(payload, secret, opts);
}

function signRefreshToken(payload: AuthPayload): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET is not configured");
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
  const opts: SignOptions = {
    expiresIn: expiresIn as any,
    algorithm: "HS256",
    jwtid: crypto.randomUUID(),
    issuer: "pothole-reporter",
    audience: "pothole-reporter-web",
  };
  return jwt.sign(payload, secret, opts);
}

async function createSession(user: UserLike, context: SessionContext = {}) {
  // Admin accounts are single-device. Citizens may keep several active
  // sessions so switching phones does not sign them out everywhere.
  if (user.role === "admin") {
    await prisma.userSession.updateMany({
      where: { user_id: user.id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }

  const sid = crypto.randomUUID();
  const payload = buildPayload(user, sid);
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.userSession.create({
    data: {
      id: sid,
      user_id: user.id,
      refresh_token_hash: hashToken(refreshToken),
      user_agent: context.userAgent || null,
      ip_address: context.ipAddress || null,
      expires_at: refreshTokenExpiry(),
    },
  });

  return {
    user: publicUser(user),
    accessToken,
    refreshToken,
  };
}

export interface CitizenRegistration {
  name: string;
  email?: string;
  phone?: string;
  password: string;
  state?: string;
  district?: string;
  locality?: string;
  mandal?: string;
}

export interface CitizenProfileUpdate {
  name?: string;
  email?: string | null;
  phone?: string;
  state?: string | null;
  district?: string | null;
  locality?: string | null;
  mandal?: string | null;
}

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
}

export async function registerUser(input: CitizenRegistration, context: SessionContext = {}) {
  const email = input.email?.trim().toLowerCase() || undefined;
  const phone = normalizePhone(input.phone);
  if (!email && !phone) throw new Error("Mobile number or email is required");

  const existingEmail = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const existingPhone = phone ? await prisma.user.findUnique({ where: { phone } }) : null;
  if (existingEmail || existingPhone) throw new Error("An account already exists with these details");

  const password_hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      name: input.name.trim(),
      email,
      phone,
      state: input.state?.trim() || undefined,
      district: input.district?.trim() || undefined,
      locality: (input.mandal ?? input.locality)?.trim() || undefined,
      password_hash,
    },
  });

  return createSession(user as UserLike, context);
}

export async function loginUser(
  identifier: string,
  password: string,
  requiredRole?: "admin" | "public",
  context: SessionContext = {},
) {
  const cleanedIdentifier = identifier.trim();
  const isEmail = cleanedIdentifier.includes("@");
  const normalizedPhone = normalizePhone(cleanedIdentifier);

  const user = isEmail
    ? await prisma.user.findUnique({ where: { email: cleanedIdentifier.toLowerCase() } })
    : normalizedPhone
      ? await prisma.user.findUnique({ where: { phone: normalizedPhone } })
      : null;

  if (!user) throw new Error("Invalid email/mobile number or password");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error("Invalid email/mobile number or password");

  if (requiredRole && user.role !== requiredRole) {
    throw new Error(requiredRole === "admin" ? "Admin access required" : "Invalid email/mobile number or password");
  }

  return createSession(user as UserLike, context);
}

export async function refreshAccessToken(token: string) {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET is not configured");

  let decoded: AuthPayload;
  try {
    decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "pothole-reporter",
      audience: "pothole-reporter-web",
    }) as AuthPayload;
  } catch {
    throw new InvalidRefreshTokenError();
  }

  if (!decoded.sid) throw new InvalidRefreshTokenError();

  const session = await prisma.userSession.findUnique({ where: { id: decoded.sid } });
  if (
    !session ||
    session.revoked_at ||
    session.expires_at <= new Date() ||
    session.refresh_token_hash !== hashToken(token)
  ) {
    throw new InvalidRefreshTokenError();
  }

  const user = await prisma.user.findUnique({ where: { id: session.user_id } });
  if (!user) throw new InvalidRefreshTokenError();

  const payload = buildPayload(user as UserLike, session.id);
  const accessToken = signAccessToken(payload);
  const newRefreshToken = signRefreshToken(payload);
  const nextExpiry = refreshTokenExpiry();

  // Conditional update: two concurrent refreshes cannot both win.
  const rotated = await prisma.userSession.updateMany({
    where: {
      id: session.id,
      revoked_at: null,
      refresh_token_hash: session.refresh_token_hash,
    },
    data: {
      refresh_token_hash: hashToken(newRefreshToken),
      last_used_at: new Date(),
      expires_at: nextExpiry,
    },
  });
  if (rotated.count !== 1) throw new InvalidRefreshTokenError();

  return { accessToken, refreshToken: newRefreshToken };
}

export async function logoutUser(userId: string, sid?: string) {
  if (sid) {
    await prisma.userSession.updateMany({
      where: { id: sid, user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  } else {
    await revokeAllSessions(userId);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { refresh_token: null, session_version: { increment: 1 } },
  });
}

export async function revokeAllSessions(userId: string) {
  await prisma.userSession.updateMany({
    where: { user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return;

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { user_id: user.id, used_at: null },
      data: { used_at: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: { user_id: user.id, token_hash: tokenHash, expires_at: expiresAt },
    }),
  ]);

  const resetLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${token}`;
  logger.info({ email: user.email }, "Password reset link generated");
  await sendPasswordResetEmail(user.email || email, resetLink);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashResetToken(token);
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { token_hash: tokenHash } });

  if (!resetToken || resetToken.used_at || resetToken.expires_at <= new Date()) {
    throw new Error("Invalid or expired reset token");
  }

  const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: resetToken.id, used_at: null, expires_at: { gt: new Date() } },
      data: { used_at: new Date() },
    });
    if (consumed.count !== 1) throw new Error("Invalid or expired reset token");

    await tx.user.update({
      where: { id: resetToken.user_id },
      data: { password_hash, refresh_token: null, session_version: { increment: 1 } },
    });
    await tx.userSession.updateMany({
      where: { user_id: resetToken.user_id, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  });
}

export async function getCurrentUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  return publicUser(user as UserLike);
}

export async function updateCurrentUser(userId: string, input: CitizenProfileUpdate) {
  const existing = await prisma.user.findUnique({ where: { id: userId } });
  if (!existing) throw new Error("User not found");
  if (
    existing.role === "admin" &&
    (input.state !== undefined || input.district !== undefined || input.locality !== undefined || input.mandal !== undefined)
  ) {
    throw new Error("Admin jurisdiction changes require an administrator");
  }

  const email = input.email === null ? null : input.email?.trim().toLowerCase();
  const phone = normalizePhone(input.phone);
  const locality = input.mandal !== undefined ? input.mandal : input.locality;

  if (email) {
    const owner = await prisma.user.findUnique({ where: { email } });
    if (owner && owner.id !== userId) throw new Error("Email is already used by another account");
  }
  if (phone) {
    const owner = await prisma.user.findUnique({ where: { phone } });
    if (owner && owner.id !== userId) throw new Error("Mobile number is already used by another account");
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.email !== undefined ? { email: email || null } : {}),
      ...(input.phone !== undefined ? { phone } : {}),
      ...(input.state !== undefined ? { state: input.state?.trim() || null } : {}),
      ...(input.district !== undefined ? { district: input.district?.trim() || null } : {}),
      ...(locality !== undefined ? { locality: locality?.trim() || null } : {}),
    },
  });
  return publicUser(user as UserLike);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
    throw new Error("Current password is incorrect");
  }
  if (await bcrypt.compare(newPassword, user.password_hash)) {
    throw new Error("New password must be different");
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      password_hash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
      refresh_token: null,
      session_version: { increment: 1 },
    },
  });
  await revokeAllSessions(userId);
}
