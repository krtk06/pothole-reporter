import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { loginLimiter, generalLimiter, refreshLimiter, forgotPasswordLimiter, resetPasswordLimiter } from "../middleware/rateLimiter";
import { authenticate } from "../middleware/auth";
import { AuthenticatedRequest, requestContext } from "../types";
import * as authService from "../services/authService";
import logger from "../config/logger";

const router = Router();
const MOBILE_CLIENT_PLATFORM = "mobile";

const registerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255).optional(),
  password: z.string().min(8).max(255),
  phone: z.string().regex(/^(?:\+?91)?[6-9]\d{9}$/).optional(),
  state: z.string().max(120).optional(),
  district: z.string().max(120).optional(),
  locality: z.string().max(160).optional(),
  mandal: z.string().max(160).optional(),
}).refine((value) => value.email || value.phone, {
  message: "Mobile number or email is required",
  path: ["phone"],
});

const loginSchema = z.object({
  identifier: z.string().min(5).max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(10).max(20).optional(),
  password: z.string().min(8).max(255),
}).refine((value) => value.identifier || value.email || value.phone, {
  message: "Mobile number or email is required",
  path: ["identifier"],
});

const profileSchema = z.object({
  name: z.string().min(2).max(255).optional(),
  email: z.union([z.string().email().max(255), z.literal(""), z.null()]).optional(),
  phone: z.string().regex(/^(?:\+?91)?[6-9]\d{9}$/).optional(),
  state: z.union([z.string().max(120), z.null()]).optional(),
  district: z.union([z.string().max(120), z.null()]).optional(),
  locality: z.union([z.string().max(160), z.null()]).optional(),
  mandal: z.union([z.string().max(160), z.null()]).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: "No profile changes supplied" });

const changePasswordSchema = z.object({
  current_password: z.string().min(8).max(255),
  new_password: z.string().min(8).max(255),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1).max(255),
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

function setAuthCookies(res: Response, result: { accessToken: string; refreshToken: string }) {
  res.cookie("accessToken", result.accessToken, { ...TOKEN_COOKIE_OPTIONS, maxAge: 60 * 60 * 1000 });
  res.cookie("refreshToken", result.refreshToken, { ...TOKEN_COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

router.post("/register", generalLimiter, validate(registerSchema), async (req: Request, res: Response) => {
  try {
    // The web portal is admin-login only; citizens register through the mobile
    // app. Keeping web registration closed prevents scope/account abuse.
    if (!isMobileClient(req)) {
      return res.status(403).json({ error: "Public web registration is disabled. Continue as guest." });
    }

    const result = await authService.registerUser(req.body, requestContext(req));
    setAuthCookies(res, result);
    res.status(201).json(authResponse(result, true));
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post("/login", loginLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { identifier, email, phone, password } = req.body;
    const value = identifier || phone || email;
    // The main website is the admin console. Mobile clients also allow
    // citizens to sign in.
    const requiredRole = isMobileClient(req) ? undefined : "admin";
    const result = await authService.loginUser(value, password, requiredRole, requestContext(req));

    setAuthCookies(res, result);
    res.json(authResponse(result, isMobileClient(req)));
  } catch (err: any) {
    return res.status(401).json({ error: err.message });
  }
});

router.post("/refresh", refreshLimiter, async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    const result = await authService.refreshAccessToken(token);
    setAuthCookies(res, result);
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
    await authService.logoutUser(req.user!.userId, req.user!.sid);
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

router.patch("/me", authenticate, validate(profileSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await authService.updateCurrentUser(req.user!.userId, {
      ...req.body,
      email: req.body.email === "" ? null : req.body.email,
    });
    res.json({ user });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

router.post("/change-password", authenticate, validate(changePasswordSchema), async (req: AuthenticatedRequest, res: Response) => {
  try {
    await authService.changePassword(req.user!.userId, req.body.current_password, req.body.new_password);
    res.clearCookie("accessToken", TOKEN_COOKIE_OPTIONS);
    res.clearCookie("refreshToken", TOKEN_COOKIE_OPTIONS);
    res.json({ message: "Password changed. Please sign in again." });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
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

router.post("/reset-password", resetPasswordLimiter, validate(resetPasswordSchema), async (req: Request, res: Response) => {
  try {
    await authService.resetPassword(req.body.token, req.body.password);
    res.json({ message: "Password has been reset. Please log in." });
  } catch (err: any) {
    logger.error({ err }, "Reset password error");
    return res.status(400).json({ error: err.message });
  }
});

export default router;
