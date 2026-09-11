import type { Metadata } from "next";
import Link from "next/link";
import { SkipLink, OfflineBanner } from "./components/site-chrome";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://try-ballast.netlify.app"),
  title: "Ballast: the overnight shift for tokenized US stocks",
  description:
    "When macro news breaks while Wall Street sleeps, Ballast shifts your tokenized-stock book into crypto. Every decision ships with the clause chain that allowed it.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Ballast: the overnight shift for tokenized US stocks",
    description:
      "A trading agent that shifts your tokenized-stock book into crypto on overnight shocks, and shows the clause chain behind every move.",
    url: "https://try-ballast.netlify.app",
    siteName: "Ballast",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ballast: the overnight shift for tokenized US stocks",
    description:
      "Macro shock at 3am? Ballast rebalances your tokenized stocks into crypto and hands you the receipt.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <SkipLink />
        <OfflineBanner />
        <header className="border-b border-[var(--border-default)]">
          <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
              BALLAST
            </Link>
            <div className="flex items-center gap-3 text-[13px] sm:gap-6 sm:text-sm">
              <Link href="/control-room" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                Control room
              </Link>
              <Link href="/policy" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                Policy
              </Link>
              <Link href="/log" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                Log
              </Link>
            </div>
          </nav>
        </header>
        <div id="main">{children}</div>
        <footer className="border-t border-[var(--border-default)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
            <span className="caption">Ballast · built for the Bitget AI Base Camp Hackathon S2</span>
            <a
              href="https://x.com/a_raphie"
              className="caption hover:text-[var(--text-primary)]"
            >
              built by Raphie
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
