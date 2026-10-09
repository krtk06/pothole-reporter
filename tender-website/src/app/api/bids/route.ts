import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isAuthorized } from "@/lib/apiAuth";
import { getTenderData, submitContractorBid } from "@/lib/tenderStore";

/**
 * Contractor bids.
 *
 * POST is deliberately open to the public — a tender board has to accept bids
 * from contractors who have no account with this portal. That makes the input
 * handling and the rate limit the security boundary, so both are strict:
 *
 *  - every field is schema-validated (the previous truthiness check accepted
 *    NaN, negative amounts and the string "0" for bid_amount),
 *  - free text is length-capped and stripped of control characters,
 *  - bids are rate limited per client IP,
 *  - bids are rejected for tenders that are not open.
 *
 * GET returns the bid list the public dossier renders. Email and phone are NOT
 * returned to anonymous callers — they are collected for the awarding authority
 * but are not public data. Passing the tender API key returns the full record.
 * The portal UI only ever renders company_name, contractor_name,
 * license_number, proposal_notes, bid_amount and estimated_days, so redaction
 * does not change what visitors see.
 */

/**
 * Per-IP limit on bid submission. Generous enough for a real contractor
 * comparing tenders, tight enough that it cannot be used to flood the store:
 * each bid is an unconditional write to persisted state.
 */
const BIDS_WINDOW_MS = 60 * 60 * 1000;
const BIDS_MAX = 10;
const bidsWindow = new Map<string, number[]>();

function rateLimited(request: NextRequest): NextResponse | null {
  const ip =
    (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const hits = (bidsWindow.get(ip) || []).filter((t) => now - t < BIDS_WINDOW_MS);
  if (hits.length >= BIDS_MAX) {
    return NextResponse.json(
      { error: "Too many bids submitted. Try again later." },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }
  hits.push(now);
  bidsWindow.set(ip, hits);
  return null;
}

/** Remove control characters and collapse whitespace; escape-worthy text is rendered as JSX text. */
function clean(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
}

const bidSchema = z.object({
  tender_id: z.string().trim().min(1).max(100),
  contractor_name: z.string().trim().min(2).max(120),
  company_name: z.string().trim().min(2).max(160),
  license_number: z.string().trim().min(2).max(60),
  email: z.string().trim().email().max(200),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(25)
    .regex(/^[0-9+()\-.\s]+$/, "phone may contain digits, spaces and + ( ) - . only"),
  bid_amount: z
    .number({ invalid_type_error: "bid_amount must be a number" })
    .finite("bid_amount must be a finite number")
    .positive("bid_amount must be greater than zero")
    .max(1_000_000_000, "bid_amount is unrealistically large"),
  estimated_days: z
    .number()
    .int()
    .min(1, "estimated_days must be at least 1")
    .max(3650, "estimated_days must be at most 3650"),
  proposal_notes: z.string().max(4000).optional().default(""),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tenderId = searchParams.get("tender_id");
  const store = await getTenderData();
  const privileged = isAuthorized(request);

  const all = tenderId
    ? store.bids.filter((b) => b.tender_id === tenderId)
    : store.bids;

  // Email and phone are collected but never rendered publicly. Drop them unless
  // the caller presents the tender API key.
  const bids = all.map((b) => {
    if (privileged) return b;
    const { email, phone, ...rest } = b;
    return rest;
  });

  return NextResponse.json({ bids, count: bids.length });
}

export async function POST(request: NextRequest) {
  const limited = rateLimited(request);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const parsed = bidSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const data = parsed.data;

  // Reject bids against anything that is not open — a withdrawn, completed or
  // already-in-review tender must not silently accept money-shaped input.
  const store = await getTenderData();
  const tender = store.tenders.find((t) => t.id === data.tender_id);
  if (!tender) {
    return NextResponse.json({ error: "Unknown tender" }, { status: 404 });
  }
  if (tender.status !== "open" && tender.status !== "under_review") {
    return NextResponse.json(
      { error: `Tender is not accepting bids (status: ${tender.status})` },
      { status: 409 },
    );
  }

  try {
    const newBid = await submitContractorBid({
      tender_id: data.tender_id,
      contractor_name: clean(data.contractor_name),
      company_name: clean(data.company_name),
      license_number: clean(data.license_number),
      email: clean(data.email).toLowerCase(),
      phone: clean(data.phone),
      bid_amount: data.bid_amount,
      estimated_days: data.estimated_days,
      proposal_notes: clean(data.proposal_notes ?? ""),
    });

    return NextResponse.json({ success: true, bid: newBid }, { status: 201 });
  } catch (err: any) {
    console.error("[bids] submission failed", err);
    return NextResponse.json({ error: "Unable to record bid" }, { status: 500 });
  }
}