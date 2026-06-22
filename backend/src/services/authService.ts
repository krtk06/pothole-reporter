import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import prisma from "../config/database";
import { AuthPayload } from "../types";

function generateAccessToken(payload: AuthPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not configured");
  const opts: SignOptions = { expiresIn: "1h" };
  return jwt.sign(payload, secret, opts);
}

function generateRefreshToken(payload: AuthPayload): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new Error("JWT_REFRESH_SECRET is not configured");
  const opts: SignOptions = { expiresIn: "7d" };
  return jwt.sign(payload, secret, opts);
}

export async function registerUser(name: string, email: string, password: string, phone?: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("Email already registered");
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
    data: { refresh_token: refreshToken },
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
    data: { refresh_token: refreshToken },
  });

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, theme_preference: user.theme_preference },
    accessToken,
    refreshToken,
  };
}

export async function refreshAccessToken(token: string) {
  try {
    const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "fallback-refresh";
    const decoded = jwt.verify(token, REFRESH_SECRET) as AuthPayload;
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || user.refresh_token !== token) {
      throw new Error("Invalid refresh token");
    }

    const payload: AuthPayload = { userId: user.id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    await prisma.user.update({
      where: { id: user.id },
      data: { refresh_token: newRefreshToken },
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
