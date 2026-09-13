import { NextRequest } from "next/server";

const CONFIGURED_API_KEY = process.env.TENDER_API_KEY || "tender_portal_secret_key_2026";

/**
 * Extracts the API key from either the 'X-API-Key' header or an
 * 'Authorization: Bearer <key>' header.
 */
export function extractApiKey(request: NextRequest): string | null {
  const headerKey = request.headers.get("x-api-key");
  if (headerKey) return headerKey.trim();

  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1].trim();
  }

  return null;
}

/** True when the request carries the configured tender API key. */
export function isAuthorized(request: NextRequest): boolean {
  const providedKey = extractApiKey(request);
  return Boolean(providedKey && providedKey === CONFIGURED_API_KEY);
}

export const UNAUTHORIZED_RESPONSE_BODY = {
  error: "Unauthorized",
  message: "Invalid or missing API key. Pass 'X-API-Key' or 'Authorization: Bearer <key>'.",
} as const;
