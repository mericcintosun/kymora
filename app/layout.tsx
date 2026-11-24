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

export const metadata: Metadata = {
  metadataBase: new URL("https://kymora.vercel.app"),
  title: {
    default: "Kymora: paper ECG strips, measured in your browser",
    template: "%s | Kymora",
  },
  description:
    "Kymora turns a phone photo of a printed lead II ECG strip into a millivolt and millisecond signal, measures heart rate and RR intervals in the browser, and refuses to answer when the photo cannot support a measurement.",
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
            <nav aria-label="Footer" className="flex gap-4">
              <Link href="/digitize" className="hover:text-foreground">
                Workspace
              </Link>
              <Link href="/how" className="hover:text-foreground">
                Method
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
