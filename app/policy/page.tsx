import { readPolicyConfig } from "@/agent/policy-config";
import { readLedger } from "@/lib/ledger";
import { Panel } from "@/app/components/kit";
import { PolicyEditor } from "./policy-editor";

export const dynamic = "force-dynamic";

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
const pp = (x: number) => `${(x * 100).toFixed(0)}`;

export default async function PolicyPage() {
  const [policy, view] = await Promise.all([readPolicyConfig(), readLedger()]);
  const k = policy.knobs;
  const t = policy.targets;

  const rules: { rule: string; knob?: Omit<KnobDef, "rule">; clauses: string[] }[] = [
    {
      rule: `Keep ${pct(t.rtokenPct)} of the book in tokenized US stocks, ${pct(t.hedgePct)} in crypto as the shield, ${pct(t.usdtPct)} in cash.`,
      knob: { key: "rtokenPct", group: "targets", value: t.rtokenPct, format: "pct", step: 1, hint: "the tokenized-stock sleeve target" },
      clauses: [],
    },
    {
      rule: `The crypto shield stays between ${pct(k.hedgeBandMin)} and ${pct(k.hedgeBandMax)} of the book, never outside.`,
      knob: { key: "hedgeBandMin", group: "knobs", value: k.hedgeBandMin, format: "pct", step: 1, hint: "shield floor" },
      clauses: ["B3-hedge-band"],
    },
    {
      rule: `The shield ceiling: the crypto sleeve may never exceed ${pct(k.hedgeBandMax)}.`,
      knob: { key: "hedgeBandMax", group: "knobs", value: k.hedgeBandMax, format: "pct", step: 1, hint: "shield ceiling (the floor is the row above)" },
      clauses: ["B3-hedge-band"],
    },
    {
      rule: `Only act when a sleeve drifts more than ${pp(k.driftPp)} points from its target.`,
      knob: { key: "driftPp", group: "knobs", value: k.driftPp, format: "pp", step: 1, hint: "how far the book may wander before a fix is proposed" },
      clauses: ["B1-drift"],
    },
    {
      rule: `Never add risk while the book is down more than ${(k.drawdownMax * 100) % 1 === 0 ? (k.drawdownMax * 100).toFixed(0) : (k.drawdownMax * 100).toFixed(1)}% on its day.`,
      knob: { key: "drawdownMax", group: "knobs", value: k.drawdownMax, format: "pct", step: 0.5, hint: "the drawdown guard" },
      clauses: ["B2-drawdown"],
    },
    {
      rule: `A shift needs a real headline: medium severity or higher in the last ${k.eventLookbackHours} hours.`,
      knob: { key: "eventLookbackHours", group: "knobs", value: k.eventLookbackHours, format: "num", step: 1, hint: "the trigger lookback window" },
      clauses: ["B4-event"],
    },
    {
      rule: `Nothing trades within ${k.blackoutMinutes} minutes of the US open or close.`,
      knob: { key: "blackoutMinutes", group: "knobs", value: k.blackoutMinutes, format: "num", step: 5, hint: "the bell blackout" },
      clauses: ["B5-blackout"],
    },
    {
      rule: `No single position grows past ${pct(k.concentrationMax)} of the book.`,
      knob: { key: "concentrationMax", group: "knobs", value: k.concentrationMax, format: "pct", step: 1, hint: "the concentration cap" },
      clauses: ["B6-concentration"],
    },
    {
      rule: `If market data goes stale beyond ${k.staleMaxSeconds} seconds, stand down entirely.`,
      knob: { key: "staleMaxSeconds", group: "knobs", value: k.staleMaxSeconds, format: "num", step: 30, hint: "the staleness halt" },
      clauses: ["B7-stale"],
    },
  ];

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
        Your rules
      </h1>
      <p className="caption mt-2 max-w-2xl">
        You write the rules once. The agent re-reads this rulebook before every decision, and no
        prompt can weaken it: the gate is deterministic code. Every change is versioned and
        recorded in the ledger; the running agent cites the version it obeyed.
      </p>

      <Panel className="mt-8 p-6">
        <PolicyEditor knobs={rules.filter((r) => r.knob).map((r) => ({ rule: r.rule, ...r.knob! }))} />
      </Panel>

      <Panel className="mt-6 p-6">
        <h2 className="font-[family-name:var(--font-display)] mb-4 text-lg font-semibold">
          Lifetime record · policy v{policy.version}
        </h2>
        <div className="space-y-3">
          {policy.clauses.map((c) => {
            const s = view.clauseStats[c.id] ?? { pass: 0, fail: 0, halt: 0 };
            return (
              <div key={c.id} id={c.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border-default)] pb-3 last:border-b-0 last:pb-0 scroll-mt-20">
                <div>
                  <span className="mono text-[var(--text-secondary)]">{c.id}</span>
                  <span className="ml-3 text-sm">{c.text}</span>
                </div>
                <span className="num caption">
                  ✓ {s.pass} · ✗ {s.fail} · ‖ {s.halt}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>
    </main>
  );
}

interface KnobDef {
  key: string;
  group: "targets" | "knobs";
  hint: string;
  value: number;
  format: "pct" | "num" | "pp";
  step: number;
}
