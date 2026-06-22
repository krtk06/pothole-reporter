import { Router, Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { loginLimiter } from "../middleware/rateLimiter";
import { authenticate } from "../middleware/auth";
import { AuthenticatedRequest } from "../types";
import * as authService from "../services/authService";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8).max(255),
  phone: z.string().max(20).optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

router.post("/register", validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { name, email, password, phone } = req.body;
    const result = await authService.registerUser(name, email, password, phone);

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/login", loginLimiter, validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: result.user,
      accessToken: result.accessToken,
    });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (!token) {
      res.status(400).json({ error: "Refresh token required" });
      return;
    }

    const result = await authService.refreshAccessToken(token);

    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ accessToken: result.accessToken });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

router.post("/logout", authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await authService.logoutUser(req.user!.userId);
    res.clearCookie("refreshToken");
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
