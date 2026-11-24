"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-5 py-24 text-center">
      <h2 className="text-3xl font-semibold">Kymora hit an error on this page</h2>
      <p className="mx-auto max-w-[60ch] text-muted-foreground">
        Nothing was uploaded, and your photo stayed on this device. Try again, or start over from the home page.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button onClick={() => reset()}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Back to Kymora home</Link>
        </Button>
      </div>
    </div>
  );
}
