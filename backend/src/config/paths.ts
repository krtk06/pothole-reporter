import path from "path";

/**
 * One resolved uploads directory for both the multer writers and the static
 * reader. The handoff previously used process.cwd() in one place and
 * __dirname/../../ in another, so starting the server from the repository root
 * made uploaded evidence and the static route point at different folders.
 */
export const UPLOADS_DIR = path.resolve(
  process.env.UPLOADS_DIR || path.join(__dirname, "../../uploads"),
);

export const EVIDENCE_METADATA_DIR = path.join(UPLOADS_DIR, ".metadata");
