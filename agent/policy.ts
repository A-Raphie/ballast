// Policy engine: the deterministic gate. LLM proposes; this disposes.
//   time = O(m), space = O(m)   m = clause count (7), per tick
//   structure: clause array of pure measures over a PolicyContext + PolicyConfig
//   family: linear scan (map)
// Invariant: a clause that cannot be measured returns pass=null; any null forces
// result "halt" (never auto-pass). NaN inputs are unmeasurable, never false-pass.
//
// Every number in this file comes from policy/policy.json (readPolicyConfig) —
// the site's rule editors write that file, and the next tick obeys it. No
// threshold lives in code.

import { readPolicyConfig, type PolicyConfig } from "./policy-config";
import type {
  BookState,
  ClauseVerdict,
  MacroEvent,
  ProposalEvent,
  VerdictEvent,
} from "./types";

export type { PolicyConfig };

export interface PolicyContext {
  now: number;
  book: BookState;
  pxOf: Map<string, number>; // symbol -> last price this tick (Map: O(1) lookups)
  recentMacro: MacroEvent[]; // events within lookback window, newest first
  dataAgeMs: number; // age of freshest market row
}

export interface Clause {
  id: string;
  measure: (
    ctx: PolicyContext,
    p: ProposalEvent,
    cfg: PolicyConfig,
  ) => { pass: boolean | null; measured: string };
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
    measure: (ctx, _p, cfg) => {
      const { rtoken } = bookPct(ctx.book, ctx.pxOf);
      const drift = Math.abs(rtoken - ctx.book.targetRtokenPct);
      return {
        pass: drift > cfg.knobs.driftPp ? true : null,
        measured: `rtoken sleeve ${pct(rtoken)} vs target ${pct(ctx.book.targetRtokenPct)}, drift ${pct(drift)}`,
      };
    },
  },
  {
    id: "B2-drawdown",
    measure: (ctx, p, cfg) => {
      const bookValue = Object.entries(ctx.book.positions).reduce((sum, [sym, pos]) => sum + pos.qty * (ctx.pxOf.get(sym) ?? 0), ctx.book.usdt);
      const openValue = ctx.book.openValue24h;
      if (!openValue || openValue <= 0) return { pass: null, measured: "no 24h-open book value recorded" };
      const dd = (openValue - bookValue) / openValue;
      const increasesRisk = p.action === "shift" && p.to !== "USDT";
      return {
        pass: dd > cfg.knobs.drawdownMax && increasesRisk ? false : true,
        measured: `drawdown ${pct(dd)} vs ${pct(cfg.knobs.drawdownMax)} limit, risk-increasing: ${increasesRisk}`,
      };
    },
  },
  {
    id: "B3-hedge-band",
    measure: (ctx, p, cfg) => {
      const { crypto } = bookPct(ctx.book, ctx.pxOf);
      // The band rule judges shifts that TOUCH the crypto sleeve. A shift that
      // moves cash or rTokens leaves the hedge sleeve untouched, so it cannot
      // violate the band (a risk-reducing trim must never be blocked here).
      let projected: number;
      let touched = true;
      if (p.to === "crypto") projected = crypto + p.ratio * (1 - crypto);
      else if (p.from === "hedge-sleeve") projected = crypto * (1 - p.ratio);
      else {
        touched = false; // the shift moves cash or rTokens: the hedge sleeve is untouched
        projected = crypto;
      }
      return {
        pass: !touched || (projected >= cfg.knobs.hedgeBandMin && projected <= cfg.knobs.hedgeBandMax) ? true : false,
        measured: touched
          ? `after shift: hedge sleeve ${pct(projected)} vs band ${pct(cfg.knobs.hedgeBandMin)}-${pct(cfg.knobs.hedgeBandMax)}`
          : `hedge sleeve untouched at ${pct(crypto)}`,
      };
    },
  },
  {
    id: "B4-event",
    measure: (ctx, _p, cfg) => {
      const cutoff = ctx.now - cfg.knobs.eventLookbackHours * 3600 * 1000;
      const hit = ctx.recentMacro.find((m) => m.ts >= cutoff && m.severity !== "low");
      return {
        pass: hit ? true : null,
        measured: hit
          ? `${hit.severity}: "${hit.headline.slice(0, 80)}" (${new Date(hit.ts).toISOString()})`
          : `no qualifying macro event in ${cfg.knobs.eventLookbackHours}h`,
      };
    },
  },
  {
    id: "B5-blackout",
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
    measure: (ctx, p, cfg) => {
      // Project the book AFTER the shift (the clause promises post-shift
      // concentration): buying grows the destination position, cash moves the
      // other way. Measuring the CURRENT book instead would block diversifying
      // buys that actually dilute the largest position.
      const positions: Record<string, number> = {};
      for (const [sym, pos] of Object.entries(ctx.book.positions)) {
        positions[sym] = pos.qty * (ctx.pxOf.get(sym) ?? 0);
      }
      const totalNow = Object.values(positions).reduce((s, v) => s + v, ctx.book.usdt);
      if (totalNow <= 0) return { pass: null, measured: "book value unmeasurable" };
      const buy = p.to === "crypto" || p.to === "rtoken-sleeve";
      // sells size against the SOURCE sleeve's value (same basis as the executor)
      const srcSymbol = p.from === "hedge-sleeve" ? "BTCUSDT" : "RNVDAUSDT";
      const notional = buy
        ? ctx.book.usdt * p.ratio
        : (positions[srcSymbol] ?? 0) * p.ratio;
      const destSymbol = p.symbol ?? (p.to === "crypto" ? "BTCUSDT" : "RNVDAUSDT");
      if (buy) {
        const destPx = ctx.pxOf.get(destSymbol);
        if (destPx === undefined) return { pass: null, measured: `no live price for ${destSymbol}` };
        positions[destSymbol] = (positions[destSymbol] ?? 0) + notional;
      } else {
        const srcSymbol = p.from === "hedge-sleeve" ? "BTCUSDT" : "RNVDAUSDT";
        positions[srcSymbol] = (positions[srcSymbol] ?? 0) - notional;
      }
      // a funded buy/sell moves cash against the position: book total ~constant
      const totalAfter = totalNow;
      let worst = { sym: "-", share: 0 };
      for (const [sym, value] of Object.entries(positions)) {
        const share = Math.max(0, value) / totalAfter;
        if (share > worst.share) worst = { sym, share };
      }
      return {
        pass: worst.share > cfg.knobs.concentrationMax ? false : true,
        measured: `after shift: largest ${worst.sym} at ${pct(worst.share)} vs ${pct(cfg.knobs.concentrationMax)} cap`,
      };
    },
  },
  {
    id: "B7-stale",
    measure: (ctx, _p, cfg) => {
      const stale = ctx.dataAgeMs > cfg.knobs.staleMaxSeconds * 1000;
      return { pass: stale ? false : true, measured: `freshest market data ${Math.round(ctx.dataAgeMs / 1000)}s old vs ${cfg.knobs.staleMaxSeconds}s limit` };
    },
  },
];

function clauseThreshold(id: string, cfg: PolicyConfig): string {
  switch (id) {
    case "B1-drift": return `drift > ${(cfg.knobs.driftPp * 100).toFixed(0)}pp`;
    case "B2-drawdown": return `dd <= ${pct(cfg.knobs.drawdownMax)} or risk-reducing`;
    case "B3-hedge-band": return `${pct(cfg.knobs.hedgeBandMin)}-${pct(cfg.knobs.hedgeBandMax)}`;
    case "B4-event": return `severity >= medium within ${cfg.knobs.eventLookbackHours}h`;
    case "B5-blackout": return "outside open/close ±30min";
    case "B6-concentration": return `max position <= ${pct(cfg.knobs.concentrationMax)}`;
    case "B7-stale": return `data age <= ${cfg.knobs.staleMaxSeconds}s`;
    default: return "-";
  }
}

export async function evaluate(
  ctx: PolicyContext,
  proposal: ProposalEvent,
  proposalId: string,
  cfg?: PolicyConfig,
): Promise<VerdictEvent> {
  const config = cfg ?? (await readPolicyConfig());
  const clauses: ClauseVerdict[] = CLAUSES.map((c) => {
    const r = c.measure(ctx, proposal, config);
    return { id: c.id, text: clauseText(c.id, config), measured: r.measured, threshold: clauseThreshold(c.id, config), pass: r.pass };
  });
  let result: VerdictEvent["result"];
  if (clauses.some((c) => c.pass === false)) result = "deny";
  else if (clauses.some((c) => c.pass === null)) result = "halt";
  else result = "allow";
  return { kind: "verdict", proposalId, clauses, result, ts: ctx.now, policyVersion: config.version };
}

function clauseText(id: string, cfg: PolicyConfig): string {
  return cfg.clauses.find((c) => c.id === id)?.text ?? id;
}
