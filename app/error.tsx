"use client";

import { ErrorState } from "@/components/states";

/** Root error boundary. The per-route error.tsx files reuse this component. */
export default function RouteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-5 py-24">
      <ErrorState
        title="Kymora hit an error on this page"
        message="Nothing was uploaded, and your photo stayed on this device. Try again, or start over from the home page."
        onRetry={() => reset()}
        homeHref="/"
      />
    </div>
  );
}
