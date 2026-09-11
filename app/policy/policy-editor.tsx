"use client";

// The rule editor. Plain-English rules with their live numbers; saving writes
// policy.json through /api/policy, which validates, bumps the version, and
// appends a policy_change event to the ledger. The running agent obeys the new
// numbers on its next tick (15 min cadence).
// Unit scaling: pct and pp knobs DISPLAY in human units (65, 2.5, 10) and save
// as fractions (0.65, 0.025, 0.1) — the UI never shows a raw fraction next to
// a "%" or "pp" label.

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Knob {
  key: string;
  group: "targets" | "knobs";
  rule: string;
  hint: string;
  value: number; // stored fraction / raw seconds
  format: "pct" | "num" | "pp";
  step: number;
}

const toDisplay = (v: number, format: Knob["format"]) =>
  format === "pct" || format === "pp" ? Math.round(v * 100 * 100) / 100 : v;
const toStored = (v: number, format: Knob["format"]) =>
  format === "pct" || format === "pp" ? v / 100 : v;

export function PolicyEditor({
  knobs,
}: {
  knobs: Knob[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(knobs.map((k) => [`${k.group}.${k.key}`, toDisplay(k.value, k.format)])),
  );
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "ok" | "error"; message?: string }>({ kind: "idle" });
  const dirty = knobs.some((k) => toDisplay(k.value, k.format) !== values[`${k.group}.${k.key}`]);

  const set = (id: string, v: number) => setValues((s) => ({ ...s, [id]: v }));

  if (typeof window !== "undefined") {
    window.onbeforeunload = dirty ? () => true : null;
  }

  async function save() {
    setStatus({ kind: "saving" });
    const body: Record<string, Record<string, number>> = { targets: {}, knobs: {} };
    for (const k of knobs) {
      const id = `${k.group}.${k.key}`;
      body[k.group][k.key] = toStored(values[id], k.format);
    }
    try {
      const res = await fetch("/api/policy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setStatus({ kind: "error", message: json.error ?? `HTTP ${res.status}` });
        return;
      }
      setStatus({
        kind: "ok",
        message: `Saved as policy v${json.version}. The running agent obeys it on its next tick (within 15 minutes), and the change is recorded in the ledger.`,
      });
      router.refresh();
    } catch (e) {
      setStatus({ kind: "error", message: String(e).slice(0, 120) });
    }
  }

  return (
    <div>
      <div className="space-y-3">
        {knobs.map((k) => {
          const id = `${k.group}.${k.key}`;
          return (
            <div key={id} className="grid grid-cols-[1fr_9rem] items-baseline gap-3 border-b border-[var(--border-default)] pb-3">
              <div>
                <div className="text-sm text-[var(--text-primary)]">{k.rule}</div>
                <div className="caption mt-0.5">{k.hint}</div>
              </div>
              <div className="flex items-baseline justify-end gap-2">
                <input
                  type="number"
                  step={k.step}
                  value={values[id]}
                  onChange={(e) => set(id, Number(e.target.value))}
                  className="num card w-24 bg-[var(--bg-base)] px-2 py-1.5 text-right text-sm outline-none"
                  aria-label={k.rule}
                />
                <span className="micro w-8">{k.format === "pct" ? "%" : k.format === "pp" ? "pp" : ""}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex items-center gap-4">
        <button onClick={save} disabled={status.kind === "saving"} className="btn btn-ghost font-semibold">
          {status.kind === "saving" ? "Saving…" : dirty ? "Save rules" : "No changes to save"}
        </button>
        {dirty && status.kind !== "saving" && <span className="micro text-[var(--status-deny)]">unsaved changes</span>}
        {status.kind === "ok" && <span className="caption text-[var(--status-pass)]">{status.message}</span>}
        {status.kind === "error" && <span className="caption text-[var(--status-deny)]">{status.message}</span>}
      </div>
      <p className="caption mt-3">
        Saving writes the policy file, bumps its version, and records the change in the ledger.
        The agent cannot skip this trail: its next verdict cites the version you saved.
      </p>
      <p className="caption mt-2 text-[var(--text-muted)]">
        On the public deploy the rulebook is read-only: the agent holds the pen, and rule changes
        ship through its repo. Self-hosted instances accept writes.
      </p>
    </div>
  );
}
