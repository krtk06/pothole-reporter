import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { forgotPasswordLimiter, loginLimiter, generalLimiter, refreshLimiter } from "../middleware/rateLimiter";
import { authenticate } from "../middleware/auth";
import { AuthenticatedRequest } from "../types";
import * as authService from "../services/authService";
import logger from "../config/logger";

const router = Router();
const MOBILE_CLIENT_PLATFORM = "mobile";

const registerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8).max(255),
  phone: z.string().max(20).optional(),
  state: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  mandal: z.string().max(100).optional(),
  admin_scope: z.enum(["mandal", "district", "state"]).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(255),
});

const TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as "none" | "lax",
  path: "/",
};

function isMobileClient(req: Request): boolean {
  return req.header("X-Client-Platform")?.toLowerCase() === MOBILE_CLIENT_PLATFORM;
}

function authResponse(result: { user?: unknown; accessToken: string; refreshToken: string }, includeRefreshToken: boolean) {
  return {
    ...(result.user ? { user: result.user } : {}),
    accessToken: result.accessToken,
    ...(includeRefreshToken ? { refreshToken: result.refreshToken } : {}),
  };
}

router.post("/register", generalLimiter, validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone, state, district, mandal, admin_scope } = req.body;
    const result = await authService.registerUser(name, email, password, phone, state, district, mandal, admin_scope);

    res.cookie("accessToken", result.accessToken, { ...TOKEN_COOKIE_OPTIONS, maxAge: 60 * 60 * 1000 });
    res.cookie("refreshToken", result.refreshToken, { ...TOKEN_COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.status(201).json(authResponse(result, isMobileClient(req)));
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post("/login", loginLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);

    res.cookie("accessToken", result.accessToken, { ...TOKEN_COOKIE_OPTIONS, maxAge: 60 * 60 * 1000 });
    res.cookie("refreshToken", result.refreshToken, { ...TOKEN_COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json(authResponse(result, isMobileClient(req)));
  } catch (err: any) {
    return res.status(401).json({ error: err.message });
  }
});

router.post("/refresh", refreshLimiter, async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (!token) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    const result = await authService.refreshAccessToken(token);

    res.cookie("accessToken", result.accessToken, { ...TOKEN_COOKIE_OPTIONS, maxAge: 60 * 60 * 1000 });
    res.cookie("refreshToken", result.refreshToken, { ...TOKEN_COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });

    res.json(authResponse(result, isMobileClient(req)));
  } catch (err: any) {
    if (err instanceof authService.InvalidRefreshTokenError) {
      return res.status(401).json({ error: err.message });
    }
    logger.error({ err }, "Refresh token error");
    return res.status(500).json({ error: "Unable to refresh session" });
  }
});

router.post("/logout", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await authService.logoutUser(req.user!.userId);
    res.clearCookie("accessToken", TOKEN_COOKIE_OPTIONS);
    res.clearCookie("refreshToken", TOKEN_COOKIE_OPTIONS);
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, "Logout failed");
    return res.status(500).json({ error: err.message });
  }
});

router.get("/me", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await authService.getCurrentUser(req.user!.userId);
    res.json({ user });
  } catch (err: any) {
    logger.error({ err }, "Get current user error");
    return res.status(404).json({ error: "User not found" });
  }
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

router.post("/forgot-password", forgotPasswordLimiter, validate(forgotPasswordSchema), async (req: Request, res: Response) => {
  try {
    await authService.forgotPassword(req.body.email);
    res.json({ message: "If that email is registered, a reset link has been sent." });
  } catch (err: any) {
    logger.error({ err }, "Forgot password error");
    return res.status(500).json({ error: "Failed to process request" });
  }
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(255),
});

router.post("/reset-password", validate(resetPasswordSchema), async (req: Request, res: Response) => {
  try {
    await authService.resetPassword(req.body.token, req.body.password);
    res.json({ message: "Password has been reset. Please log in." });
  } catch (err: any) {
    logger.error({ err }, "Reset password error");
    return res.status(400).json({ error: err.message });
  }
});

export default router;
