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
          <div className="mx-auto grid max-w-6xl gap-6 px-5 py-10 text-sm text-muted-foreground sm:grid-cols-[1fr_auto]">
            <p className="max-w-[68ch]">
              Kymora is a research prototype for the AI for Medicine student hackathon. It measures rhythm on a single
              lead II strip and does not diagnose. Photos are processed on your device and never uploaded.
            </p>
            <nav aria-label="Footer" className="flex flex-wrap gap-x-4">
              <Link href="/digitize" className="inline-flex min-h-11 items-center hover:text-foreground">
                Workspace
              </Link>
              <Link href="/how" className="inline-flex min-h-11 items-center hover:text-foreground">
                Method
              </Link>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center hover:text-foreground">
                Source on GitHub
              </a>
            </nav>
            <p className="sm:col-span-2">
              Data handling and security notes:{" "}
              <a
                href={`${REPO_URL}/blob/main/SECURITY.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block py-3 underline decoration-line underline-offset-4 hover:text-foreground"
              >
                SECURITY.md
              </a>
              . No wallet, no account, no upload.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
