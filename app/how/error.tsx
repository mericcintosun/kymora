"use client";

import RouteError from "../error";

export default function HowError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} />;
}
