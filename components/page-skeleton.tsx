/**
 * Static loading placeholder in sand steps (SURFACE, DEEP, LINE). Matte, no motion,
 * so it reads the same with reduced motion and never flashes a pulse.
 */
export function PageSkeleton({ label, panels = 2 }: { label: string; panels?: number }) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="space-y-4">
        <div className="h-14 w-3/4 max-w-xl rounded-md bg-surface sm:h-16" />
        <div className="h-5 w-full max-w-2xl rounded-md bg-surface" />
        <div className="h-5 w-2/3 max-w-xl rounded-md bg-surface" />
      </div>
      <div aria-hidden className="mt-10 space-y-4">
        {Array.from({ length: panels }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-md border border-border bg-surface">
            <div className="h-40 bg-deep sm:h-56" />
            <div className="h-2 bg-line" />
            <div className="space-y-2 p-4">
              <div className="h-4 w-1/2 rounded-md bg-deep" />
              <div className="h-4 w-1/3 rounded-md bg-deep" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
