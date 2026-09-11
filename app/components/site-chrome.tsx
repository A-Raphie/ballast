"use client";

// Skip link + offline banner: site chrome the audit battery looks for.
import { useEffect, useState } from "react";

export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-input)] focus:bg-[var(--decision)] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-[var(--bg-base)]"
    >
      Skip to content
    </a>
  );
}

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (!offline) return null;
  return (
    <div className="bg-[var(--status-deny-bg)] px-4 py-2 text-center text-xs text-[var(--status-deny)]" role="status">
      You are offline. Showing the last synced ledger.
    </div>
  );
}
