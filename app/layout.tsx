import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ballast: the overnight shift for tokenized US stocks",
  description:
    "When macro news breaks while Wall Street sleeps, Ballast shifts your tokenized-stock book into crypto. Every shift ships with the clause chain that allowed it.",
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
        <header className="border-b border-[var(--border-default)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
              BALLAST
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/control-room" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                Control room
              </Link>
              <Link href="/policy" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                Policy
              </Link>
              <Link href="/log" className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                Log
              </Link>
            </nav>
          </div>
        </header>
        {children}
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
