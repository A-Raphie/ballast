"use client";

// The rule board.
//   Structural actions (add / delete / toggle a rule) APPLY IMMEDIATELY: each
//   one commits the rulebook to the agent's repo and is recorded in the ledger,
//   so rules survive refresh by design.
//   Number tuning stays staged behind "Save rules" (one commit for the batch).
// Unit scaling: pct/pp knobs display in human units (65, 2.5, 10) and save as
// fractions (0.65, 0.025, 0.1).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ruleName } from "@/lib/display";

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

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; version?: string }> {
  const res = await fetch("/api/policy", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) return { ok: false, error: json.error ?? `HTTP ${res.status}` };
  return { ok: true, version: json.version };
}

export function PolicyBoard({
  targets,
  knobs,
  coreClauses,
  library,
  stats,
  selfHosted,
}: {
  targets: { rtokenPct: number; hedgePct: number; usdtPct: number };
  knobs: Record<string, number>;
  coreClauses: { id: string; text: string; threshold: string; enabled: boolean }[];
  library: LibraryRow[];
  stats: Record<string, { pass: number; fail: number; halt: number }>;
  selfHosted: boolean;
}) {
  const router = useRouter();

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
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "ok" | "error"; message?: string } | null>(null);

  const val = (key: string): number => nums[key]?.v ?? 0;
  const fmt = (key: string): Format => nums[key]?.f ?? "num";
  const show = (key: string): string => {
    const f = fmt(key);
    const v = val(key);
    return f === "pct" && !Number.isInteger(v) ? v.toFixed(1) : String(v);
  };
  const setNum = (key: string, v: number) => setNums((s) => ({ ...s, [key]: { ...(s[key] ?? { f: "num" as Format }), v } }));

  const numbersDirty = Object.entries(initialNums).some(([k, init]) => nums[k]?.v !== init.v);
  const [numbersSaving, setNumbersSaving] = useState(false);
  async function saveNumbers() {
    setNumbersSaving(true);
    const r = await post({
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
    });
    setNumbersSaving(false);
    if (!r.ok) {
      setStatus({ kind: "error", message: r.error ?? "failed" });
      return;
    }
    setStatus({ kind: "ok", message: `Saved (rules v${r.version}). Ballast picks them up on its next check, within 15 minutes.` });
    router.refresh();
  }

  const coreRules: CoreRule[] = [
    {
      id: "targets",
      sentence: `Keep ${show("targets.rtokenPct")}% of the portfolio in tokenized US stocks, ${show("targets.hedgePct")}% in crypto as the shield, and ${show("targets.usdtPct")}% in cash.`,
      toggle: false,
      inputs: [
        { key: "targets.rtokenPct", label: "tokenized stocks", format: "pct", step: 1 },
        { key: "targets.hedgePct", label: "crypto shield", format: "pct", step: 1 },
        { key: "targets.usdtPct", label: "cash", format: "pct", step: 1 },
      ],
    },
    {
      id: "B1-drift",
      sentence: `Only trade when a holding group has wandered more than ${show("knobs.driftPp")} points away from its target share.`,
      toggle: true,
      inputs: [{ key: "knobs.driftPp", label: "points of drift allowed", format: "pp", step: 1 }],
    },
    {
      id: "B2-drawdown",
      sentence: `If the portfolio is down more than ${show("knobs.drawdownMax")}% on its day, make no trade that adds risk.`,
      toggle: true,
      inputs: [{ key: "knobs.drawdownMax", label: "bad-day limit", format: "pct", step: 0.5 }],
    },
    {
      id: "B3-hedge-band",
      sentence: `The crypto shield must stay between ${show("knobs.hedgeBandMin")}% and ${show("knobs.hedgeBandMax")}% of the portfolio.`,
      toggle: true,
      inputs: [
        { key: "knobs.hedgeBandMin", label: "shield floor", format: "pct", step: 1 },
        { key: "knobs.hedgeBandMax", label: "shield ceiling", format: "pct", step: 1 },
      ],
    },
    {
      id: "B4-event",
      sentence: `Only trade after a big-enough news story within the last ${show("knobs.eventLookbackHours")} hours.`,
      toggle: true,
      inputs: [{ key: "knobs.eventLookbackHours", label: "news lookback (hours)", format: "num", step: 1 }],
    },
    {
      id: "B5-blackout",
      sentence: `Stay quiet within ${show("knobs.blackoutMinutes")} minutes of the US market opening or closing.`,
      toggle: true,
      inputs: [{ key: "knobs.blackoutMinutes", label: "quiet minutes around open/close", format: "num", step: 5 }],
    },
    {
      id: "B6-concentration",
      sentence: `No single holding may grow past ${show("knobs.concentrationMax")}% of the portfolio.`,
      toggle: true,
      inputs: [{ key: "knobs.concentrationMax", label: "single-holding cap", format: "pct", step: 1 }],
    },
    {
      id: "B7-stale",
      sentence: `If market prices are older than ${show("knobs.staleMaxSeconds")} seconds, stop everything.`,
      toggle: true,
      inputs: [{ key: "knobs.staleMaxSeconds", label: "old-data limit (seconds)", format: "num", step: 30 }],
    },
  ];

  const stat = (id: string) => stats[id] ?? { pass: 0, fail: 0, halt: 0 };

  // structural actions apply immediately (each its own repo commit + ledger event)
  async function apply(body: Record<string, unknown>, what: string) {
    setBusy(what);
    setStatus({ kind: "ok", message: `${what}…` });
    const r = await post(body);
    if (!r.ok) {
      setStatus({ kind: "error", message: r.error ?? "failed" });
    } else {
      setStatus({ kind: "ok", message: `${what}: done (rules v${r.version}). Ballast picks it up on its next check, within 15 minutes.` });
      router.refresh();
    }
    setBusy(null);
  }
  const toggleClause = (id: string, current: boolean) =>
    apply({ setClauseEnabled: [{ id, enabled: !current }] }, current ? `turning off ${ruleName(id)}` : `turning on ${ruleName(id)}`);
  const deleteRule = (id: string) => apply({ removeClauses: [{ id }] }, `deleting ${ruleName(id)}`);
  const addRule = () => {
    const spec = ADDABLE[addType];
    if (!spec) return;
    const params = Object.fromEntries(Object.entries(spec.params).map(([k, p]) => [k, addParams[k] ?? p.def]));
    return apply({ addClauses: [{ type: addType, params }] }, `adding ${spec.label}`);
  };

  const [addType, setAddType] = useState<string>("");
  const [addParams, setAddParams] = useState<Record<string, number>>({});

  return (
    <div>
      {coreRules.map((r) => {
        const clause = coreClauses.find((c) => c.id === r.id);
        const on = clause ? clause.enabled : true;
        const s = clause ? stat(clause.id) : null;
        return (
          <div key={r.id} className={`border-b border-[var(--border-default)] py-4 ${on ? "" : "opacity-50"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm text-[var(--text-primary)]">{r.sentence}</div>
                {clause && s && (
                  <div className="num caption mt-1" title={`rule code ${clause.id}`}>
                    checked {s.pass} times · refused {s.fail} trades
                    {s.halt > 0 ? ` · stopped ${s.halt}` : ""}
                    <span className="mono ml-2 text-[11px] text-[var(--text-muted)]">{clause.id}</span>
                  </div>
                )}
              </div>
              {r.toggle && (
                <button
                  role="switch"
                  aria-checked={on}
                  aria-label={`toggle: ${r.sentence.slice(0, 40)}`}
                  onClick={() => toggleClause(r.id, on)}
                  disabled={busy !== null}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-[var(--decision)]" : "border border-[var(--border-strong)] bg-[var(--bg-raised)]"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--bg-base)] transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
                </button>
              )}
            </div>
            {on && r.inputs.length > 0 && (
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

      {library.length > 0 && (
        <div className="mt-6">
          <div className="micro mb-3">Added rules</div>
          {library.map((c) => {
            const on = c.enabled;
            return (
              <div key={c.id} className={`mb-3 border-b border-[var(--border-default)] pb-3 ${on ? "" : "opacity-50"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm">{c.text}</div>
                    <div className="num caption mt-0.5" title={`rule code ${c.id}`}>
                      checked {stat(c.id).pass} times · refused {stat(c.id).fail} trades
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      role="switch"
                      aria-checked={on}
                      aria-label={`toggle ${c.id}`}
                      onClick={() => toggleClause(c.id, on)}
                      disabled={busy !== null}
                      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-[var(--decision)]" : "border border-[var(--border-strong)] bg-[var(--bg-raised)]"}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--bg-base)] transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                    <button
                      onClick={() => deleteRule(c.id)}
                      disabled={busy !== null}
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
            <button onClick={addRule} disabled={busy !== null} className="btn btn-primary !min-h-0 !px-4 !py-1.5 text-xs">
              {busy === `adding ${ADDABLE[addType].label}` ? "Adding…" : "Add rule"}
            </button>
          )}
        </div>
        {busy && <p className="caption mt-2 text-[var(--text-secondary)]">{busy} · saving to the rulebook Ballast reads…</p>}
        {status && status.kind === "ok" && <p className="caption mt-2 text-[var(--status-pass)]">{status.message}</p>}
        {status && status.kind === "error" && <p className="caption mt-2 text-[var(--status-deny)]">{status.message}</p>}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-[var(--border-default)] pt-4">
        <button onClick={saveNumbers} disabled={!numbersDirty || numbersSaving} className="btn btn-primary !min-h-0 !px-4 !py-1.5 text-xs">
          {numbersSaving ? "Saving…" : "Save numbers"}
        </button>
        <button onClick={() => setNums(initialNums)} disabled={!numbersDirty || numbersSaving} className="btn btn-ghost !min-h-0 !px-4 !py-1.5 text-xs">
          Reset
        </button>
        {numbersSaving && <span className="micro text-[var(--text-secondary)]">saving…</span>}
        {!numbersSaving && numbersDirty && <span className="micro text-[var(--status-deny)]">unsaved number changes</span>}
        <span className="caption text-[var(--text-muted)]">
          Rule adds, deletes, and toggles apply immediately; only number tuning needs this button.
        </span>
      </div>
    </div>
  );
}
