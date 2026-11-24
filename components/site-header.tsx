import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { MobileNav } from "@/components/mobile-nav";
import { NavLinks, type NavLink } from "@/components/nav-links";
import { Button } from "@/components/ui/button";
import { FEATURED_STRIP_ID } from "@/lib/data";

/** Inline links from md up: at most three links plus the CTA (IDENTITY.md, S2). */
const links: NavLink[] = [
  { href: `/digitize/${FEATURED_STRIP_ID}`, label: "Example result" },
  { href: "/how", label: "Method & evaluation" },
];

/** The below-md disclosure lists every demo route: the workspace, the example result and /how. */
const mobileLinks: NavLink[] = [
  { href: "/digitize", label: "Workspace" },
  { href: `/digitize/${FEATURED_STRIP_ID}`, label: "Example result" },
  { href: "/how", label: "Method & evaluation" },
];

const cta: NavLink = { href: `/digitize?strip=${FEATURED_STRIP_ID}`, label: "Digitize a strip" };

/** HEADER row of IDENTITY.md: solid ground, border-b in LINE, sticky. One brand mark, inside the brand link. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 font-display text-xl font-semibold text-foreground">
          <BrandMark size={30} />
          Kymora
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 md:gap-3">
          <NavLinks links={links} />
          <Button asChild size="sm" className="hidden md:inline-flex">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
          <MobileNav links={mobileLinks} cta={cta} />
        </nav>
      </div>
    </header>
  );
}
