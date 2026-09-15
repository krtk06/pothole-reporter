"use client";

import { useRouter } from "next/navigation";
import { Compass } from "lucide-react";
import { MagneticButton, Pill, Reveal, Surface } from "@/components/macadam";

export default function NotFound() {
  const router = useRouter();

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <Reveal className="w-full max-w-lg">
        <Surface level={2} className="text-center">
          <div className="flex justify-center">
            <Pill tone="bad" mono>
              Error 404
            </Pill>
          </div>
          <p className="mt-6 font-mono text-6xl font-semibold tracking-tight text-ink">404</p>
          <h1 className="mt-3 font-display text-2xl font-bold tracking-[-0.02em] text-ink">
            This road doesn&rsquo;t exist
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ink2">
            The page you are looking for has been moved or was never paved.
          </p>
          <div className="mt-7 flex justify-center">
            <MagneticButton variant="primary" onClick={() => router.push("/")}>
              <Compass className="h-4 w-4" />
              Go home
            </MagneticButton>
          </div>
        </Surface>
      </Reveal>
    </main>
  );
}
