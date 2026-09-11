"use client";

// The rule editor. Plain-English rules with their live numbers; saving writes
// policy.json through /api/policy, which validates, bumps the version, and
// appends a policy_change event to the ledger. The running agent obeys the new
// numbers on its next tick (15 min cadence).

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Knob {
  key: string;
  group: "targets" | "knobs";
  rule: string;
  hint: string;
  value: number;
  format: "pct" | "num" | "pp";
  step: number;
}

export function PolicyEditor({
  knobs,
}: {
  knobs: Knob[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries(knobs.map((k) => [`${k.group}.${k.key}`, k.value])),
  );
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "ok" | "error"; message?: string }>({ kind: "idle" });

  const set = (id: string, v: number) => setValues((s) => ({ ...s, [id]: v }));

  async function save() {
    setStatus({ kind: "saving" });
    const body: Record<string, Record<string, number>> = { targets: {}, knobs: {} };
    for (const [id, v] of Object.entries(values)) {
      const [group, key] = id.split(".");
      body[group][key] = v;
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
        <button onClick={save} disabled={status.kind === "saving"} className="btn btn-primary">
          {status.kind === "saving" ? "Saving…" : "Save rules"}
        </button>
        {status.kind === "ok" && <span className="caption text-[var(--status-pass)]">{status.message}</span>}
        {status.kind === "error" && <span className="caption text-[var(--status-deny)]">{status.message}</span>}
      </div>
      <p className="caption mt-3">
        Saving writes the policy file, bumps its version, and records the change in the ledger.
        The agent cannot skip this trail: its next verdict cites the version you saved.
      </p>
    </div>
  );
}
