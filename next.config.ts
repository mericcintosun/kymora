import fs from "fs";
import path from "path";
import type { NextConfig } from "next";

// Uploaded brand images (public/brand/*.png) are listed once, at build time, so that
// components can choose between an uploaded image and its SVG fallback without touching
// the file system at request time (public/ is not readable inside a serverless function).
const brandDir = path.join(process.cwd(), "public", "brand");
const brandFiles = fs.existsSync(brandDir)
  ? fs
      .readdirSync(brandDir)
      .filter((f) => f.endsWith(".png"))
      .map((f) => f.slice(0, -4))
  : [];

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BRAND_FILES: brandFiles.join(",") },
  // /digitize renders on request and reads these with node:fs (lib/ptbxl-lookup.ts,
  // lib/held-out.ts), which file tracing cannot see. Top-level key in Next 15
  // (node_modules/next/dist/server/config-shared.d.ts). Missing files are simply skipped.
  outputFileTracingIncludes: {
    "/digitize": ["./eval/ptbxl-lookup.json", "./eval/ptbxl-results.json"],
  },
};

export default nextConfig;
