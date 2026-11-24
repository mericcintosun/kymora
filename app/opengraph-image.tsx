import { ImageResponse } from "next/og";

export const alt = "Kymora: paper ECG strips, measured in your browser";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ImageResponse cannot read CSS variables, so the IDENTITY.md key block is repeated here.
// These six values mirror IDENTITY.md exactly (GROUND, SURFACE, DEEP, LINE, INK, ACCENT) and
// app/globals.css. This is the only file in app/ and components/ allowed to hold hex literals.
const C = { ground: "#f4e9d8", surface: "#ecdcc3", deep: "#e2cfae", line: "#d2bd98", ink: "#3a2c1e", accent: "#8e2f2f" };

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.ground, position: "relative" }}>
        <div style={{ position: "absolute", right: -80, top: 40, width: 420, height: 420, borderRadius: 9999, background: C.deep, display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", padding: "72px 80px 0", position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <svg width="72" height="72" viewBox="0 0 64 64">
              <rect x="2" y="2" width="60" height="60" rx="6" fill={C.surface} stroke={C.line} strokeWidth="2" />
              <path d="M5 42H17L21 37L25 42H28L31 48L36 11L41 52L44 42H48Q52 34 56 42H59" fill="none" stroke={C.accent} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ fontSize: 56, fontWeight: 700, color: C.ink, display: "flex" }}>Kymora</div>
          </div>
          <div style={{ marginTop: 48, fontSize: 84, lineHeight: 1, fontWeight: 700, color: C.ink, display: "flex", maxWidth: 950 }}>
            Paper ECG, read to the millisecond.
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: C.ink, opacity: 0.75, display: "flex", maxWidth: 900 }}>
            Phone photo of a lead II strip in, heart rate and RR intervals out. In the browser, with a quality gate.
          </div>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ height: 18, background: C.deep, display: "flex" }} />
          <div style={{ height: 26, background: C.line, display: "flex" }} />
          <div style={{ height: 14, background: C.accent, display: "flex" }} />
        </div>
      </div>
    ),
    size
  );
}
