"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavLink } from "@/components/nav-links";
import { cn } from "@/lib/utils";

/**
 * Below-md navigation: one disclosure button that opens a solid ground panel under the
 * header with every demo route and the CTA. It closes on route change and on Escape.
 * From md up the inline NavLinks take over and this component renders nothing visible.
 */
export function MobileNav({ links, cta }: { links: NavLink[]; cta: NavLink }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="kymora-mobile-nav"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-border px-3 text-sm font-medium text-foreground hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
      >
        {open ? "Close" : "Menu"}
      </button>
      <div
        id="kymora-mobile-nav"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-border bg-background md:hidden"
      >
        <ul className="mx-auto flex max-w-6xl flex-col px-5 py-3">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <li key={l.href} className="border-b border-border/60 last:border-b-0">
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center rounded-md px-1 text-base hover:bg-surface",
                    active ? "font-medium text-foreground underline decoration-primary decoration-2 underline-offset-[6px]" : "text-muted-foreground"
                  )}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
          <li className="pt-3">
            <Link
              href={cta.href}
              className="flex min-h-11 w-full items-center justify-center rounded-md border-b-2 border-second bg-primary px-4 text-base font-medium text-primary-foreground hover:bg-second"
            >
              {cta.label}
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}
