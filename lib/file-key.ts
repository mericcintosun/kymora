/**
 * Idempotency key for a dropped photo: the same file dropped twice (same name, size
 * and modification time) gets the same key, so the workspace reuses its local result
 * id instead of writing a second sessionStorage entry. Pure, no DOM needed.
 */
export function fileKey(file: Pick<File, "name" | "size" | "lastModified">): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}
