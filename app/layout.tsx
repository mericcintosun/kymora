import type { Metadata } from "next";
import { Rubik, Spectral } from "next/font/google";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-spectral",
});

const rubik = Rubik({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-rubik",
});

const TITLE = "Kymora: paper ECG strips measured on-device";
// 144 characters: the problem, then the fix.
const DESCRIPTION =
  "Paper ECGs get measured by eye with a ruler. Kymora reads a phone photo of a lead II strip in your browser: heart rate, RR intervals, no upload.";

const REPO_URL = "https://github.com/mericcintosun/kymora";
const HACKATHON_URL = "https://ai-for-medicine.devpost.com/";
const FOOTER_LINK =
  "inline-flex min-h-11 items-center underline decoration-line underline-offset-4 hover:text-foreground hover:decoration-primary";

export const metadata: Metadata = {
  // The live URL from README.md. og:image resolves against it, so it must be the deployed host.
  metadataBase: new URL("https://kymora-eight.vercel.app"),
  title: {
    default: TITLE,
    template: "%s | Kymora",
  },
  description: DESCRIPTION,
  // The og:image and twitter:image tags come from app/opengraph-image.tsx (1200x630).
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "website",
    siteName: "Kymora",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spectral.variable} ${rubik.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <SiteHeader />
        <main>{children}</main>
        <footer className="mt-24 border-t border-border bg-surface">
          <div aria-hidden className="h-1.5 bg-deep" />
          <div className="mx-auto max-w-6xl space-y-4 px-5 py-10 text-sm text-muted-foreground">
            <p className="max-w-[68ch]">
              A research prototype that measures rhythm on one lead II strip, never diagnoses, and keeps every photo on
              your device.
            </p>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-5">
              <Link href="/digitize" className={FOOTER_LINK}>
                Workspace
              </Link>
              <Link href="/how" className={FOOTER_LINK}>
                Method
              </Link>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK}>
                Source on GitHub
              </a>
              <a href={HACKATHON_URL} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK}>
                AI for Medicine hackathon
              </a>
              <a href={`${REPO_URL}/blob/main/SECURITY.md`} target="_blank" rel="noopener noreferrer" className={FOOTER_LINK}>
                SECURITY.md
              </a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
