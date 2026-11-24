/**
 * Pure helpers shared by the client workspace and the server: no node: imports here.
 */

/**
 * The PTB-XL ecg_id a dropped photo's filename names, or null.
 *
 * Rule: drop the extension, split the name into maximal runs of digits, and take the
 * first run. ecg_ids run from 1 to 21837, so a run must be 1 to 5 digits long. A name
 * with any run of 6 or more digits is rejected outright, because that is a phone
 * camera name (IMG_20241103.jpg, PXL_20241103_101500.jpg) and its digits are a date,
 * not a record id. Names with no digits, or whose first run is all zeros, give null.
 *
 *   00009.png             -> 9
 *   9.jpg                 -> 9
 *   ecg_00009_photo.jpeg  -> 9
 *   IMG_00009 (1).png     -> 9
 *   IMG_20241103.jpg      -> null
 *   strip.png             -> null
 */
export function ecgIdFromFilename(name: string): number | null {
  const base = name.replace(/\.[A-Za-z0-9]+$/, "");
  const runs = base.match(/[0-9]+/g);
  if (!runs) return null;
  if (runs.some((r) => r.length >= 6)) return null;
  const id = Number.parseInt(runs[0], 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}
