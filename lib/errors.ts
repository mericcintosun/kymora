/**
 * Error codes shared by the API routes and the server loaders. Every error a client
 * sees has the shape { error, hint }: a fixed code plus one plain sentence.
 */
export type ErrorCode = "invalid_input" | "upstream_timeout" | "upstream_error" | "parse_failure" | "not_configured";

export type ApiError = { error: ErrorCode; hint: string };

export function apiError(code: ErrorCode, hint: string): ApiError {
  return { error: code, hint };
}
