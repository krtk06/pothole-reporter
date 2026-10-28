/**
 * Pothole evidence (photo or video) shown on the admin reports table.
 *
 * Source precedence matters here. The API's `image_url` is a presigned
 * S3 link, but on the current deployment every one of those returns
 * HTTP 400: `X-Amz-Credential` is signed without an access key id, so
 * the signature cannot validate. The backend's own `/uploads/<key>`
 * static route serves the same bytes and does work.
 *
 * So we prefer that route, fall back to `image_url`, and finally to the
 * "pending" placeholder. If presigning is fixed later this keeps working
 * unchanged, since every path is tried in order and each failure falls
 * through via onError.
 */

const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".m4v", ".avi"];
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

export type EvidenceKind = "image" | "video" | "none";

export interface EvidenceSource {
  /** First candidate. Kept for callers that only need one. */
  url: string | null;
  /** Every candidate, in the order they should be tried on load failure. */
  sources: string[];
  kind: EvidenceKind;
  /** Where the first candidate came from, for diagnosing which path is live. */
  origin: "uploads" | "presigned" | "none";
}

function extensionOf(value: string): string {
  const path = value.split("?")[0];
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot).toLowerCase();
}

/**
 * Both `image_s3_key` and `image_url` may carry the extension; the key
 * is authoritative, the URL is only a fallback signal.
 */
export function evidenceKind(
  imageS3Key?: string | null,
  imageUrl?: string | null
): EvidenceKind {
  const ext = extensionOf(imageS3Key || "") || extensionOf(imageUrl || "");
  if (VIDEO_EXTENSIONS.includes(ext)) return "video";
  if (IMAGE_EXTENSIONS.includes(ext)) return "image";
  return "none";
}

export function evidenceSource(
  imageS3Key?: string | null,
  imageUrl?: string | null
): EvidenceSource {
  const kind = evidenceKind(imageS3Key, imageUrl);
  if (kind === "none") return { url: null, sources: [], kind, origin: "none" };

  // Candidates in preference order. The presigned S3 URL goes first because it
  // is the AWS-native path and works whenever the server's credentials are
  // valid; the /uploads proxy is the fallback for deployments whose backend
  // serves that route. Previously only one was chosen, so when /uploads was
  // absent (the backend in this repository has no such route) every evidence
  // image 404'd and the presigned URL was never attempted.
  const candidates: string[] = [];
  const presigned = (imageUrl || "").trim();
  if (presigned) candidates.push(presigned);

  // image_s3_key already carries the `uploads/` prefix, so serving
  // /uploads/<key> verbatim yields /uploads/uploads/<file> and 404s.
  const key = (imageS3Key || "").replace(/^\/+/, "");
  const path = key.replace(/^uploads\//, "");
  if (path) candidates.push(`/uploads/${path}`);

  const sources = [...new Set(candidates)];
  if (sources.length === 0) return { url: null, sources: [], kind, origin: "none" };
  return { url: sources[0], sources, kind, origin: presigned ? "presigned" : "uploads" };
}

export const EVIDENCE_VIDEO_EXTENSIONS = VIDEO_EXTENSIONS;
export const EVIDENCE_IMAGE_EXTENSIONS = IMAGE_EXTENSIONS;