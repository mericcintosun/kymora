"use client";

import RouteError from "../../error";

export default function ResultError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} />;
}
