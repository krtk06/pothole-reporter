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
  url: string | null;
  kind: EvidenceKind;
  /** Where `url` came from, for diagnosing which path is live. */
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
  if (kind === "none") return { url: null, kind, origin: "none" };

  // image_s3_key already carries the `uploads/` prefix, so serving
  // /uploads/<key> verbatim yields /uploads/uploads/<file> and 404s.
  // SERVER_HANDOFF.md flagged this; verified against the live proxy.
  const key = (imageS3Key || "").replace(/^\/+/, "");
  const path = key.replace(/^uploads\//, "");
  if (path) {
    return { url: `/uploads/${path}`, kind, origin: "uploads" };
  }
  if (imageUrl) {
    return { url: imageUrl, kind, origin: "presigned" };
  }
  return { url: null, kind, origin: "none" };
}

export const EVIDENCE_VIDEO_EXTENSIONS = VIDEO_EXTENSIONS;
export const EVIDENCE_IMAGE_EXTENSIONS = IMAGE_EXTENSIONS;