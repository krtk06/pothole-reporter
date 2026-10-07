"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { FileImage, Video, X } from "lucide-react";
import { evidenceSource, type EvidenceSource } from "@/lib/evidence";

interface EvidenceLightboxProps {
  reportId: string;
  imageS3Key?: string | null;
  imageUrl?: string | null;
  open: boolean;
  onClose: () => void;
}

/**
 * Full-size evidence viewer for the admin reports table.
 *
 * Mirrors the tender portal's photo lightbox so the two portals behave
 * identically, extended to play video inline since three of the four
 * current evidence objects are `.mp4` rather than images.
 *
 * Every load path falls back to a placeholder rather than showing a
 * broken image, because the presigned URLs this would normally prefer
 * are currently returning HTTP 400 — see src/lib/evidence.ts.
 */
export function EvidenceLightbox({
  reportId,
  imageS3Key,
  imageUrl,
  open,
  onClose,
}: EvidenceLightboxProps) {
  const source: EvidenceSource = evidenceSource(imageS3Key, imageUrl);
  // Reset on close so reopening a failed item retries rather than showing
  // the previous error state.
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [open, reportId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-3"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Full evidence preview"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative max-h-[88vh] max-w-5xl overflow-hidden rounded-xl border border-hairline bg-surface p-1"
          onClick={(e) => e.stopPropagation()}
          initial={{ scale: 0.97, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.97, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close evidence preview"
            className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-surface/95 text-ink transition-colors hover:bg-sunken"
          >
            <X className="h-4 w-4" />
          </button>

          {source.kind === "video" && source.url && !failed ? (
            <video
              key={source.url}
              src={source.url}
              controls
              playsInline
              onError={() => setFailed(true)}
              className="max-h-[84vh] w-full rounded-lg bg-black"
            />
          ) : source.kind === "image" && source.url && !failed ? (
            <img
              key={source.url}
              src={source.url}
              alt="Full evidence preview"
              onError={() => setFailed(true)}
              className="max-h-[84vh] w-full rounded-lg object-contain"
            />
          ) : (
            <div className="flex max-h-[84vh] w-[min(90vw,26rem)] flex-col items-center justify-center gap-3 px-6 py-14 text-center">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-sunken text-ink3">
                <FileImage className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold text-ink">
                {failed ? "Evidence unavailable" : "No evidence attached"}
              </p>
              <p className="max-w-xs text-xs leading-relaxed text-ink3">
                {failed
                  ? "The evidence file could not be loaded from the server. It may have expired or not finished uploading."
                  : "This report was submitted without a photo or video."}
              </p>
            </div>
          )}

          {source.kind === "video" && (
            <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink2">
              <Video className="h-3 w-3" />
              Video evidence
            </span>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}