"use client";

// The rule board: read the rulebook, tune numbers, switch rules on/off, add
// rules from the library, delete added rules. One Save = one commit to the
// agent's repo + one policy_change event in the ledger.
// Unit scaling: pct/pp knobs display in human units (65, 2.5, 10) and save as
// fractions (0.65, 0.025, 0.1).

import { useState } from "react";
import { useRouter } from "next/navigation";

type Format = "pct" | "num" | "pp";

interface CoreRule {
  id: string;
  sentence: string;
  inputs: { key: string; label: string; format: Format; step: number }[];
  toggle: boolean;
}

interface LibraryRow {
  id: string;
  type: string;
  params: Record<string, number>;
  enabled: boolean;
  text: string;
}

const toDisplay = (v: number, f: Format) => (f === "pct" || f === "pp" ? Math.round(v * 100 * 100) / 100 : v);
const toStored = (v: number, f: Format) => (f === "pct" || f === "pp" ? v / 100 : v);

const ADDABLE: Record<string, { label: string; hint: string; params: Record<string, { label: string; def: number; format: Format }> }> = {
  "max-trades-per-day": {
    label: "Max trades per day",
    hint: "cap how many trades the agent may make in one UTC day",
    params: { max: { label: "max trades", def: 4, format: "num" } },
  },
  "min-cash-buffer": {
    label: "Min cash buffer",
    hint: "never let cash fall below a floor share of the book",
    params: { minPct: { label: "min cash", def: 8, format: "pct" } },
  },
  "volatility-halt": {
    label: "Volatility halt",
    hint: "stand down while any held symbol moves more than X% in 24h",
    params: { maxMovePct: { label: "max 24h move", def: 6, format: "pct" } },
  },
  "daily-turnover-cap": {
    label: "Daily turnover cap",
    hint: "cap the total notional traded in one UTC day",
    params: { maxNotional: { label: "max $ traded", def: 8000, format: "num" } },
  },
};

export function PolicyBoard({
  version,
  targets,
  knobs,
  coreClauses,
  library,
  stats,
}: {
  version: string;
  targets: { rtokenPct: number; hedgePct: number; usdtPct: number };
  knobs: Record<string, number>;
  coreClauses: { id: string; text: string; threshold: string; enabled: boolean }[];
  library: LibraryRow[];
  stats: Record<string, { pass: number; fail: number; halt: number }>;
}) {
  const router = useRouter();

  // staged display values for numbers (keyed "group.key")
  const initialNums: Record<string, { v: number; f: Format }> = {
    "targets.rtokenPct": { v: toDisplay(targets.rtokenPct, "pct"), f: "pct" },
    "targets.hedgePct": { v: toDisplay(targets.hedgePct, "pct"), f: "pct" },
    "targets.usdtPct": { v: toDisplay(targets.usdtPct, "pct"), f: "pct" },
    "knobs.driftPp": { v: toDisplay(knobs.driftPp, "pp"), f: "pp" },
    "knobs.drawdownMax": { v: toDisplay(knobs.drawdownMax, "pct"), f: "pct" },
    "knobs.hedgeBandMin": { v: toDisplay(knobs.hedgeBandMin, "pct"), f: "pct" },
    "knobs.hedgeBandMax": { v: toDisplay(knobs.hedgeBandMax, "pct"), f: "pct" },
    "knobs.eventLookbackHours": { v: knobs.eventLookbackHours, f: "num" },
    "knobs.blackoutMinutes": { v: knobs.blackoutMinutes, f: "num" },
    "knobs.concentrationMax": { v: toDisplay(knobs.concentrationMax, "pct"), f: "pct" },
    "knobs.staleMaxSeconds": { v: knobs.staleMaxSeconds, f: "num" },
  };
  const [nums, setNums] = useState(initialNums);
  const [enabled, setEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(coreClauses.map((c) => [c.id, c.enabled])),
  );
  const [lib, setLib] = useState<LibraryRow[]>(library.map((c) => ({ ...c })));
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [added, setAdded] = useState<{ type: string; params: Record<string, number>; text: string }[]>([]);
  const [addType, setAddType] = useState<string>("");
  const [addParams, setAddParams] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "ok" | "error"; message?: string }>({ kind: "idle" });

  const val = (key: string): number => nums[key]?.v ?? 0;
  const fmt = (key: string): Format => nums[key]?.f ?? "num";
  const show = (key: string): string => {
    const f = fmt(key);
    const v = val(key);
    return f === "pct" && !Number.isInteger(v) ? v.toFixed(1) : String(v);
  };
  const setNum = (key: string, v: number) => setNums((s) => ({ ...s, [key]: { ...s[key], v } }));

  // core rule sentences (values from staged state)
  const coreRules: CoreRule[] = [
    {
      id: "targets",
      sentence: `Keep ${show("targets.rtokenPct")}% of the book in tokenized US stocks, ${show("targets.hedgePct")}% in crypto as the shield, ${show("targets.usdtPct")}% in cash.`,
      toggle: false,
      inputs: [
        { key: "targets.rtokenPct", label: "rToken sleeve", format: "pct", step: 1 },
        { key: "targets.hedgePct", label: "crypto shield", format: "pct", step: 1 },
        { key: "targets.usdtPct", label: "cash", format: "pct", step: 1 },
      ],
    },
    {
      id: "B1-drift",
      sentence: `Only act when a sleeve drifts more than ${show("knobs.driftPp")} points from its target.`,
      toggle: true,
      inputs: [{ key: "knobs.driftPp", label: "drift tolerance", format: "pp", step: 1 }],
    },
    {
      id: "B2-drawdown",
      sentence: `Never add risk while the book is down more than ${show("knobs.drawdownMax")}% on its day.`,
      toggle: true,
      inputs: [{ key: "knobs.drawdownMax", label: "drawdown guard", format: "pct", step: 0.5 }],
    },
    {
      id: "B3-hedge-band",
      sentence: `The crypto shield stays between ${show("knobs.hedgeBandMin")}% and ${show("knobs.hedgeBandMax")}% of the book, never outside.`,
      toggle: true,
      inputs: [
        { key: "knobs.hedgeBandMin", label: "shield floor", format: "pct", step: 1 },
        { key: "knobs.hedgeBandMax", label: "shield ceiling", format: "pct", step: 1 },
      ],
    },
    {
      id: "B4-event",
      sentence: `A shift needs a real headline: medium severity or higher in the last ${show("knobs.eventLookbackHours")} hours.`,
      toggle: true,
      inputs: [{ key: "knobs.eventLookbackHours", label: "trigger lookback", format: "num", step: 1 }],
    },
    {
      id: "B5-blackout",
      sentence: `Nothing trades within ${show("knobs.blackoutMinutes")} minutes of the US open or close.`,
      toggle: true,
      inputs: [{ key: "knobs.blackoutMinutes", label: "bell blackout", format: "num", step: 5 }],
    },
    {
      id: "B6-concentration",
      sentence: `No single position grows past ${show("knobs.concentrationMax")}% of the book.`,
      toggle: true,
      inputs: [{ key: "knobs.concentrationMax", label: "concentration cap", format: "pct", step: 1 }],
    },
    {
      id: "B7-stale",
      sentence: `If market data goes stale beyond ${show("knobs.staleMaxSeconds")} seconds, stand down entirely.`,
      toggle: true,
      inputs: [{ key: "knobs.staleMaxSeconds", label: "staleness halt", format: "num", step: 30 }],
    },
  ];

  const dirty =
    Object.entries(initialNums).some(([k, init]) => nums[k]?.v !== init.v) ||
    coreClauses.some((c) => enabled[c.id] !== c.enabled) ||
    removedIds.length > 0 ||
    added.length > 0;

  async function save() {
    setStatus({ kind: "saving" });
    const body: Record<string, unknown> = {
      targets: {
        rtokenPct: toStored(val("targets.rtokenPct"), fmt("targets.rtokenPct")),
        hedgePct: toStored(val("targets.hedgePct"), fmt("targets.hedgePct")),
        usdtPct: toStored(val("targets.usdtPct"), fmt("targets.usdtPct")),
      },
      knobs: {
        driftPp: toStored(val("knobs.driftPp"), fmt("knobs.driftPp")),
        drawdownMax: toStored(val("knobs.drawdownMax"), fmt("knobs.drawdownMax")),
        hedgeBandMin: toStored(val("knobs.hedgeBandMin"), fmt("knobs.hedgeBandMin")),
        hedgeBandMax: toStored(val("knobs.hedgeBandMax"), fmt("knobs.hedgeBandMax")),
        eventLookbackHours: val("knobs.eventLookbackHours"),
        blackoutMinutes: val("knobs.blackoutMinutes"),
        concentrationMax: toStored(val("knobs.concentrationMax"), fmt("knobs.concentrationMax")),
        staleMaxSeconds: val("knobs.staleMaxSeconds"),
      },
    };
    const toggles = coreClauses
      .filter((c) => enabled[c.id] !== c.enabled)
      .map((c) => ({ id: c.id, enabled: enabled[c.id] }));
    if (toggles.length > 0) body.setClauseEnabled = toggles;
    if (removedIds.length > 0) body.removeClauses = removedIds.map((id) => ({ id }));
    if (added.length > 0) body.addClauses = added.map((a) => ({ type: a.type, params: a.params }));
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
        message: `Saved as policy v${json.version}. The running agent pulls it before its next tick (within 15 minutes), and the change is recorded in the ledger.`,
      });
      router.refresh();
    } catch (e) {
      setStatus({ kind: "error", message: String(e).slice(0, 120) });
    }
  }

  const coreRuleFor = (id: string) => coreRules.find((r) => r.id === id);
  const stat = (id: string) => stats[id] ?? { pass: 0, fail: 0, halt: 0 };

  return (
    <div>
      {coreRules.map((r) => {
        const clause = coreClauses.find((c) => c.id === r.id);
        const on = r.toggle ? enabled[r.id] !== false : true;
        const s = clause ? stat(clause.id) : null;
        return (
          <div key={r.id} className={`border-b border-[var(--border-default)] py-4 ${on ? "" : "opacity-50"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-[var(--text-primary)]">{r.sentence}</div>
                {clause && s && (
                  <div className="num caption mt-1">
                    {clause.id} · ✓ {s.pass} · ✗ {s.fail} · ‖ {s.halt}
                  </div>
                )}
              </div>
              {r.toggle && (
                <button
                  role="switch"
                  aria-checked={on}
                  aria-label={`toggle: ${r.sentence}`}
                  onClick={() => setEnabled((prev) => ({ ...prev, [r.id]: !on }))}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-[var(--decision)]" : "border border-[var(--border-strong)] bg-[var(--bg-raised)]"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--bg-base)] transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                </button>
              )}
            </div>
            {r.inputs.length > 0 && on && (
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                {r.inputs.map((inp) => (
                  <label key={inp.key} className="flex items-baseline gap-2 text-xs text-[var(--text-secondary)]">
                    {inp.label}
                    <input
                      type="number"
                      step={inp.step}
                      value={nums[inp.key]?.v ?? 0}
                      onChange={(e) => setNum(inp.key, Number(e.target.value))}
                      className="num card w-20 bg-[var(--bg-base)] px-2 py-1 text-right text-xs outline-none"
                      aria-label={inp.label}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {lib.length > 0 && (
        <div className="mt-6">
          <div className="micro mb-3">Added rules</div>
          {lib.map((c) => {
            const on = enabled[c.id] !== false && c.enabled !== false;
            return (
              <div key={c.id} className={`mb-3 border-b border-[var(--border-default)] pb-3 ${on ? "" : "opacity-50"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="num text-sm">{c.text}</div>
                    <div className="num caption mt-0.5">
                      {c.id} · ✓ {stat(c.id).pass} · ✗ {stat(c.id).fail}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      role="switch"
                      aria-checked={on}
                      aria-label={`toggle ${c.id}`}
                      onClick={() => setEnabled((s) => ({ ...s, [c.id]: !on }))}
                      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-[var(--decision)]" : "border border-[var(--border-strong)] bg-[var(--bg-raised)]"}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--bg-base)] transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                    <button
                      onClick={() => {
                        setRemovedIds((r) => [...r, c.id]);
                        setLib((l) => l.filter((x) => x.id !== c.id));
                      }}
                      className="btn btn-ghost !min-h-0 !px-3 !py-1 text-xs text-[var(--status-deny)]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6">
        <div className="micro mb-2">Add a rule from the library</div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={addType}
            onChange={(e) => {
              setAddType(e.target.value);
              const spec = ADDABLE[e.target.value];
              if (spec) setAddParams(Object.fromEntries(Object.entries(spec.params).map(([k, p]) => [k, p.def])));
            }}
            className="card bg-[var(--bg-base)] px-3 py-2 text-sm outline-none"
            aria-label="rule type"
          >
            <option value="">choose a rule…</option>
            {Object.entries(ADDABLE).map(([t, spec]) => (
              <option key={t} value={t}>
                {spec.label}
              </option>
            ))}
          </select>
          {addType &&
            Object.entries(ADDABLE[addType].params).map(([k, p]) => (
              <label key={k} className="flex items-baseline gap-1.5 text-xs text-[var(--text-secondary)]">
                {p.label}
                <input
                  type="number"
                  value={addParams[k] ?? p.def}
                  onChange={(e) => setAddParams((s) => ({ ...s, [k]: Number(e.target.value) }))}
                  className="num card w-20 bg-[var(--bg-base)] px-2 py-1 text-right text-xs outline-none"
                  aria-label={`${p.label} for ${ADDABLE[addType].label}`}
                />
              </label>
            ))}
          {addType && (
            <button
              onClick={() => {
                const spec = ADDABLE[addType];
                const params = Object.fromEntries(Object.entries(spec.params).map(([k, p]) => [k, addParams[k] ?? p.def]));
                const text = Object.entries(ADDABLE[addType].params)
                  .map(([k, p]) => `${p.label} ${params[k]}${p.format === "pct" ? "%" : ""}`)
                  .join(", ");
                setAdded((a) => [...a, { type: addType, params, text: `${spec.label}: ${text}` }]);
                setAddType("");
                setAddParams({});
              }}
              className="btn btn-ghost !min-h-0 !px-3 !py-1.5 text-xs"
            >
              Add
            </button>
          )}
        </div>
        {added.length > 0 && (
          <ul className="mt-3 space-y-1">
            {added.map((a, i) => (
              <li key={i} className="caption flex items-center justify-between">
                <span>
                  + {a.text} <span className="text-[var(--text-muted)]">(will be added on save)</span>
                </span>
                <button onClick={() => setAdded((arr) => arr.filter((_, j) => j !== i))} className="caption underline">
                  remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button onClick={save} disabled={status.kind === "saving"} className="btn btn-ghost font-semibold">
          {status.kind === "saving" ? "Saving…" : dirty ? "Save rules" : "No changes to save"}
        </button>
        {dirty && status.kind !== "saving" && <span className="micro text-[var(--status-deny)]">unsaved changes</span>}
        {status.kind === "ok" && <span className="caption text-[var(--status-pass)]">{status.message}</span>}
        {status.kind === "error" && <span className="caption text-[var(--status-deny)]">{status.message}</span>}
      </div>
      <p className="caption mt-3">
        A save commits the new rulebook to the agent's repo. The running agent pulls it before
        its next tick, obeys it, and cites that version in every verdict that follows. Core
        guards can be switched off here but never deleted; added rules can be deleted.
      </p>
      <span className="hidden">{version}</span>
    </div>
  );
}
