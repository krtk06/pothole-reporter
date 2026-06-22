"use client";

import { RetroTvError } from "@/components/ui/404-error-page";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center gap-8 px-4">
      <RetroTvError errorCode="404" errorMessage="NOT FOUND" />
      <div className="text-center">
        <p className="text-[var(--color-text-secondary)] mb-4 text-sm">
          The page you're looking for doesn't exist.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 border border-[var(--color-border)] rounded-full px-6 py-3 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
