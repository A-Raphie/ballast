"use client";

// Status truth model + the pause control.
//   on shift  = the agent ticked within the last 20 minutes
//   stale     = the mirror is 20+ minutes behind the agent's own host
//   paused    = the agent is explicitly paused (agent-state.json)
// The public deploy mirrors the ledger; it says so instead of pretending.

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AgentStatus = "on-shift" | "stale" | "paused";

export function StatusBadge({
  status,
  lastSenseAgeMin,
  selfHosted,
}: {
  status: AgentStatus;
  lastSenseAgeMin: number;
  selfHosted: boolean;
}) {
  const map = {
    "on-shift": { dot: "bg-[var(--decision)]", label: "Ballast on shift", detail: `last check ${lastSenseAgeMin} min ago` },
    stale: { dot: "bg-[var(--status-deny)]", label: "live feed out of date", detail: `no fresh data for ${lastSenseAgeMin} min · the agent checks every 15 min on its own host` },
    paused: { dot: "bg-[var(--text-muted)]", label: "Paused by operator", detail: "it keeps watching but makes no trades" },
  } as const;
  const m = map[status];
  return (
    <span className="inline-flex items-center gap-2" title={m.detail}>
      <span className={`inline-block h-2 w-2 rounded-full ${m.dot}`} aria-hidden />
      <span className="micro">{m.label}</span>
      <span className="micro text-[var(--text-muted)]">· {m.detail}</span>
    </span>
  );
}

export function PauseControl({ paused, selfHosted }: { paused: boolean; selfHosted: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  async function setPaused(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paused: next }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(String(e).slice(0, 100));
    } finally {
      setBusy(false);
      setArmed(false);
    }
  }

  if (!selfHosted) {
    return (
      <span className="micro text-[var(--text-muted)]" title="the public site mirrors the agent; run your own copy to command it">
        Controls live on the self-hosted copy
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      {!armed ? (
        <button onClick={() => setArmed(true)} className="btn btn-ghost !min-h-0 !px-3 !py-1 text-xs">
          {paused ? "Resume agent" : "Pause agent"}
        </button>
      ) : (
        <>
          <button onClick={() => setPaused(!paused)} disabled={busy} className="btn btn-primary !min-h-0 !px-3 !py-1 text-xs">
            {paused ? "Resume: it decides again" : "Confirm pause"}
          </button>
          <button onClick={() => setArmed(false)} className="btn btn-ghost !min-h-0 !px-3 !py-1 text-xs">
            cancel
          </button>
        </>
      )}
      {error && <span className="caption text-[var(--status-deny)]">{error}</span>}
    </span>
  );
}
