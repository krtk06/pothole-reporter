"use client";

import { useState } from "react";
import { FileImage, PlayCircle, Video } from "lucide-react";
import { evidenceSource } from "@/lib/evidence";

interface EvidenceThumbProps {
  reportId: string;
  imageS3Key?: string | null;
  imageUrl?: string | null;
  onOpen: (reportId: string) => void;
}

/**
 * Inline evidence affordance for the admin reports row.
 *
 * Photos render a real thumbnail so the row reads as visual evidence at
 * a glance. Videos get a labelled chip instead of a poster frame:
 * decoding arbitrary `.mp4` files just to paint a thumbnail is wasteful
 * on a table that lists dozens of rows, and the file sizes here are
 * ~1.8 MB each.
 *
 * A failed load degrades to the pending placeholder rather than a broken
 * image icon.
 */
export function EvidenceThumb({
  reportId,
  imageS3Key,
  imageUrl,
  onOpen,
}: EvidenceThumbProps) {
  const [failed, setFailed] = useState(false);
  const source = evidenceSource(imageS3Key, imageUrl);

  if (source.kind === "none") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-sunken px-2 py-1 text-[11px] text-ink3">
        <FileImage className="h-3 w-3" />
        No evidence
      </span>
    );
  }

  if (failed || !source.url) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-sunken px-2 py-1 text-[11px] text-ink3">
        <FileImage className="h-3 w-3" />
        S3 evidence pending sync
      </span>
    );
  }

  if (source.kind === "video") {
    return (
      <button
        type="button"
        onClick={() => onOpen(reportId)}
        className="group inline-flex items-center gap-2 rounded-md border border-hairline bg-sunken px-2.5 py-1.5 text-[11px] font-semibold text-ink2 transition-colors hover:border-accent/50 hover:text-ink"
        aria-label="Open video evidence"
      >
        <span className="relative inline-flex h-6 w-6 items-center justify-center rounded bg-accent-soft text-accent">
          <Video className="h-3.5 w-3.5" />
          <PlayCircle className="pointer-events-none absolute h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
        Video evidence
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(reportId)}
      onError={() => setFailed(true)}
      className="group relative inline-block h-14 w-20 overflow-hidden rounded-md border border-hairline bg-sunken"
      aria-label="Open evidence photo"
    >
      <img
        src={source.url}
        alt="Pothole evidence"
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.04]"
      />
      <span className="pointer-events-none absolute inset-0 bg-ink/0 transition-colors group-hover:bg-ink/10" />
    </button>
  );
}