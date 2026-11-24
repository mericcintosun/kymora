import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-5 py-24 text-center">
      <h2 className="text-3xl font-semibold">Kymora has no page here</h2>
      <p className="mx-auto max-w-[60ch] text-muted-foreground">
        The link may point to a strip id that does not exist, or to a result from a photo that was only kept in another
        browser tab.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline">
          <Link href="/">Back to Kymora home</Link>
        </Button>
        <Button asChild variant="link">
          <Link href="/digitize">Open the workspace</Link>
        </Button>
      </div>
    </div>
  );
}
