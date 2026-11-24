"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The three shared states every demo route uses: error with a retry, empty with the
 * next demo click, and a matte sand-step placeholder. Token classes only, the M3
 * `kymora-enter` entrance, no new keyframe and no pulsing.
 */

export function ErrorState({
  title,
  message,
  onRetry,
  homeHref,
  retryLabel = "Try again",
  className,
}: {
  title: string;
  message: ReactNode;
  onRetry: () => void;
  homeHref?: string;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <Card role="alert" className={cn("kymora-enter border-bad", className)}>
      <CardContent className="space-y-3">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <div className="max-w-[65ch] text-sm leading-relaxed text-muted-foreground">{message}</div>
        <div className="flex flex-wrap gap-3 pt-1">
          <Button onClick={onRetry}>{retryLabel}</Button>
          {homeHref && (
            <Button asChild variant="outline">
              <Link href={homeHref}>Back to Kymora home</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ title, message, cta, className }: { title: string; message: ReactNode; cta: ReactNode; className?: string }) {
  return (
    <Card aria-live="polite" className={cn("kymora-enter", className)}>
      <CardContent className="space-y-3">
        <p className="font-medium">{title}</p>
        <div className="max-w-[68ch] text-sm leading-relaxed text-muted-foreground">{message}</div>
        <div className="pt-1">{cta}</div>
      </CardContent>
    </Card>
  );
}

/** The flat sand-step placeholder block. Decorative, so hidden from assistive tech. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("h-40 rounded-md bg-deep/60", className)} />;
}

/** A busy panel: what is being read, one line on what happens, and the placeholder block. */
export function WorkspaceSkeleton({ label, detail }: { label: string; detail?: string }) {
  return (
    <Card role="status" aria-live="polite" aria-busy="true" className="kymora-enter">
      <CardContent className="space-y-3">
        <p className="font-medium">{label}</p>
        {detail && <p className="text-sm text-muted-foreground">{detail}</p>}
        <Skeleton />
      </CardContent>
    </Card>
  );
}
