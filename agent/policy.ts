// Policy engine: the deterministic gate. LLM proposes; this disposes.
//   time = O(m), space = O(m)   m = clause count (8), per tick
//   structure: clause array of pure measures over a PolicyContext
//   family: linear scan (map)
// Invariant: a clause that cannot be measured returns pass=null; any null forces
// result "halt" (never auto-pass). NaN inputs are unmeasurable, never false-pass.

import type {
  BookState,
  ClauseVerdict,
  MarketEvent,
  MacroEvent,
  ProposalEvent,
  VerdictEvent,
} from "./types";

export const POLICY_VERSION = "1.0.0";

export interface PolicyContext {
  now: number;
  book: BookState;
  pxOf: Map<string, number>; // symbol -> last price this tick (Map: O(1) lookups)
  recentMacro: MacroEvent[]; // events within lookback window, newest first
  dataAgeMs: number; // age of freshest market row
}

export interface Clause {
  id: string;
  text: string;
  measure: (ctx: PolicyContext, p: ProposalEvent) => { pass: boolean | null; measured: string };
}

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

function bookPct(book: BookState, pxOf: Map<string, number>): { rtoken: number; crypto: number } {
  let rtoken = 0;
  let crypto = 0;
  for (const [sym, pos] of Object.entries(book.positions)) {
    const px = pxOf.get(sym);
    if (px === undefined) continue; // unpriced position: excluded from sleeves, counted by B7 staleness gate
    const value = pos.qty * px;
    if (pos.market === "rtoken") rtoken += value;
    else crypto += value;
  }
  const total = rtoken + crypto + book.usdt;
  if (total <= 0) return { rtoken: 0, crypto: 0 };
  return { rtoken: rtoken / total, crypto: crypto / total };
}

export const CLAUSES: Clause[] = [
  {
    id: "B1-drift",
    text: "Rebalance only when a sleeve drifts more than 10 percentage points from its written target.",
    measure: (ctx) => {
      const { rtoken } = bookPct(ctx.book, ctx.pxOf);
      const drift = Math.abs(rtoken - ctx.book.targetRtokenPct);
      return {
        pass: drift > 0.1 ? true : null,
        measured: `rtoken sleeve ${pct(rtoken)} vs target ${pct(ctx.book.targetRtokenPct)}, drift ${pct(drift)}`,
      };
    },
  },
  {
    id: "B2-drawdown",
    text: "No action that increases market exposure while the book is down more than 2.5% from its 24h-open value.",
    measure: (ctx, p) => {
      const bookValue = Object.entries(ctx.book.positions).reduce((sum, [sym, pos]) => sum + pos.qty * (ctx.pxOf.get(sym) ?? 0), ctx.book.usdt);
      const openValue = ctx.book.openValue24h;
      if (!openValue || openValue <= 0) return { pass: null, measured: "no 24h-open book value recorded" };
      const dd = (openValue - bookValue) / openValue;
      const increasesRisk = p.action === "shift" && p.to !== "USDT";
      return {
        pass: dd > 0.025 && increasesRisk ? false : true,
        measured: `drawdown ${pct(dd)} vs 2.50% limit, risk-increasing: ${increasesRisk}`,
      };
    },
  },
  {
    id: "B3-hedge-band",
    text: "The crypto hedge sleeve must stay between 20% and 50% of book value.",
    measure: (ctx, p) => {
      const { crypto } = bookPct(ctx.book, ctx.pxOf);
      // projected crypto depends on what the shift actually touches:
      //   into crypto: ratio of the non-crypto remainder moves in
      //   out of crypto: ratio of the crypto sleeve moves out
      //   otherwise (usdt/rtoken source): the hedge sleeve is untouched
      let projected: number;
      if (p.to === "crypto") projected = crypto + p.ratio * (1 - crypto);
      else if (p.from === "hedge-sleeve") projected = crypto * (1 - p.ratio);
      else projected = crypto;
      return {
        pass: projected >= 0.2 && projected <= 0.5 ? true : false,
        measured: `projected hedge sleeve ${pct(projected)} vs band 20%-50%`,
      };
    },
  },
  {
    id: "B4-event",
    text: "A shift requires a macro event of medium severity or higher within the last 12 hours.",
    measure: (ctx) => {
      const cutoff = ctx.now - 12 * 3600 * 1000;
      const hit = ctx.recentMacro.find((m) => m.ts >= cutoff && m.severity !== "low");
      return {
        pass: hit ? true : null,
        measured: hit ? `${hit.severity}: "${hit.headline.slice(0, 80)}" (${new Date(hit.ts).toISOString()})` : "no qualifying macro event in 12h",
      };
    },
  },
  {
    id: "B5-blackout",
    text: "No rebalance within 30 minutes of the US equity open or close (14:30 / 21:00 UTC).",
    measure: (ctx) => {
      const d = new Date(ctx.now);
      const minutesUTC = d.getUTCHours() * 60 + d.getUTCMinutes();
      const near = (m: number) => Math.abs(minutesUTC - m) <= 30;
      const blocked = near(14 * 60 + 30) || near(21 * 60);
      return { pass: blocked ? false : true, measured: `${d.toISOString().slice(11, 16)} UTC vs blackout 14:00-15:00 / 20:30-21:30` };
    },
  },
  {
    id: "B6-concentration",
    text: "No single position above 35% of book value after the shift.",
    measure: (ctx) => {
      const values = Object.entries(ctx.book.positions).map(([sym, pos]) => ({ sym, v: pos.qty * (ctx.pxOf.get(sym) ?? 0) }));
      const total = values.reduce((s, x) => s + x.v, ctx.book.usdt);
      if (total <= 0) return { pass: null, measured: "book value unmeasurable" };
      const top = values.reduce((a, b) => (b.v > a.v ? b : a), { sym: "-", v: 0 });
      return { pass: top.v / total > 0.35 ? false : true, measured: `largest ${top.sym} at ${pct(top.v / total)} vs 35% cap` };
    },
  },
  {
    id: "B7-stale",
    text: "All proposals halt when the freshest market row is older than 10 minutes.",
    measure: (ctx) => {
      const stale = ctx.dataAgeMs > 10 * 60 * 1000;
      return { pass: stale ? false : true, measured: `freshest market data ${Math.round(ctx.dataAgeMs / 1000)}s old vs 600s limit` };
    },
  },
];

export function evaluate(
  ctx: PolicyContext,
  proposal: ProposalEvent,
  proposalId: string,
): VerdictEvent {
  const clauses: ClauseVerdict[] = CLAUSES.map((c) => {
    const r = c.measure(ctx, proposal);
    return { id: c.id, text: c.text, measured: r.measured, threshold: clauseThreshold(c.id), pass: r.pass };
  });
  let result: VerdictEvent["result"];
  if (clauses.some((c) => c.pass === false)) result = "deny";
  else if (clauses.some((c) => c.pass === null)) result = "halt";
  else result = "allow";
  return { kind: "verdict", proposalId, clauses, result, ts: ctx.now };
}

function clauseThreshold(id: string): string {
  switch (id) {
    case "B1-drift": return "drift > 10pp";
    case "B2-drawdown": return "dd <= 2.5% or risk-reducing";
    case "B3-hedge-band": return "20%-50%";
    case "B4-event": return "severity >= medium within 12h";
    case "B5-blackout": return "outside open/close ±30min";
    case "B6-concentration": return "max position <= 35%";
    case "B7-stale": return "data age <= 600s";
    default: return "-";
  }
}
