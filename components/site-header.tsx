import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { FEATURED_STRIP_ID } from "@/lib/data";

const links = [
  { href: `/digitize/${FEATURED_STRIP_ID}`, label: "Example result" },
  { href: "/how", label: "Method & evaluation" },
];

/** HEADER row of IDENTITY.md: solid ground, border-b in LINE, sticky. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-semibold text-foreground">
          <BrandMark size={30} />
          Kymora
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hidden rounded-md px-2 py-1.5 text-sm text-muted-foreground underline-offset-4 hover:bg-surface hover:text-foreground sm:inline-block"
            >
              {l.label}
            </Link>
          ))}
          <Button asChild size="sm">
            <Link href={`/digitize?strip=${FEATURED_STRIP_ID}`}>Digitize a strip</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
