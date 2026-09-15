"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import {
  Logo,
  NavBar,
  NavInner,
  NavSpacer,
  Reveal,
  Surface,
  ThemeToggle,
} from "@/components/macadam";

interface AuthShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/** A calm, centered side room of the login world for recovery surfaces. */
export default function AuthShell({ title, description, children }: AuthShellProps) {
  const { theme, toggleTheme } = useStore();

  return (
    <main className="flex min-h-dvh flex-col">
      <NavBar>
        <NavInner>
          <Link href="/login" className="inline-flex" aria-label="Back to sign in">
            <Logo src="/brand/pothole-reporter.png" name="Pothole Reporter" tagline="Road Works" />
          </Link>
          <NavSpacer />
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </NavInner>
      </NavBar>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <Reveal className="w-full max-w-md">
          <Surface level={2}>
            <h1 className="font-display text-2xl font-bold tracking-[-0.02em] text-ink">{title}</h1>
            {description && <p className="mt-2 text-sm leading-relaxed text-ink2">{description}</p>}
            <div className="mt-6 rule" />
            <div className="mt-6">{children}</div>
          </Surface>
          <p className="mt-6 text-center text-sm text-ink3">
            <Link
              href="/login"
              className="font-semibold text-ink2 underline-offset-4 transition-colors hover:text-ink hover:underline"
            >
              Back to sign in
            </Link>
          </p>
        </Reveal>
      </div>
    </main>
  );
}
