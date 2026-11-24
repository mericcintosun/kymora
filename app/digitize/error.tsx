"use client";

import RouteError from "../error";

export default function DigitizeError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} />;
}
