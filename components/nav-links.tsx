"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface NavLink {
  href: string;
  label: string;
}

/** Header links with the current route marked by aria-current and an oxblood underline. */
export function NavLinks({ links }: { links: NavLink[] }) {
  const pathname = usePathname();
  return (
    <>
      {links.map((l) => {
        const active = pathname === l.href || (l.href !== "/" && pathname.startsWith(`${l.href}/`));
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "hidden min-h-11 items-center rounded-md px-2 text-sm underline-offset-[6px] hover:bg-surface hover:text-foreground md:inline-flex",
              active ? "text-foreground underline decoration-primary decoration-2" : "text-muted-foreground"
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
