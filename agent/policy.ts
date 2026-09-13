// Policy engine: the deterministic gate. LLM proposes; this disposes.
//   time = O(c + l), space = O(c + l)   c = core clauses (7), l = library rules
//   structure: core measure implementations + typed library implementations,
//   both composed from policy/policy.json (the single source of truth)
//   family: linear scan (map)
// Invariants:
//   - disabled clauses are skipped entirely (not measured, not rendered)
//   - a clause that cannot be measured returns pass=null; per-clause
//     onUnmeasurable decides halt vs deny; NaN never false-passes
//   - every number comes from policy.json; no threshold lives in code

import { readPolicyConfig, type PolicyConfig } from "./policy-config";
import { symbolName, severityWord } from "../lib/display";
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
  pxOf: Map<string, number>; // symbol -> last price this tick
  chg24h: Map<string, number>; // symbol -> 24h change fraction
  recentMacro: MacroEvent[]; // events within lookback window, newest first
  dataAgeMs: number; // age of freshest market row
  ordersToday: number; // orders already recorded today (UTC)
  turnoverTodayUsdt: number; // notional already traded today (UTC)
}

interface MeasureResult {
  pass: boolean | null;
  measured: string;
}

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

function bookPct(book: BookState, pxOf: Map<string, number>): { rtoken: number; crypto: number } {
  let rtoken = 0;
  let crypto = 0;
  for (const [sym, pos] of Object.entries(book.positions)) {
    const px = pxOf.get(sym);
    if (px === undefined) continue;
    const value = pos.qty * px;
    if (pos.market === "rtoken") rtoken += value;
    else crypto += value;
  }
  const total = rtoken + crypto + book.usdt;
  if (total <= 0) return { rtoken: 0, crypto: 0 };
  return { rtoken: rtoken / total, crypto: crypto / total };
}

type CoreMeasure = (ctx: PolicyContext, p: ProposalEvent, cfg: PolicyConfig) => MeasureResult;

const CORE_MEASURES: Record<string, CoreMeasure> = {
  "B1-drift": (ctx, _p, cfg) => {
    const { rtoken } = bookPct(ctx.book, ctx.pxOf);
    const drift = Math.abs(rtoken - ctx.book.targetRtokenPct);
    return {
      pass: drift > cfg.knobs.driftPp ? true : null,
      measured: `tokenized stocks at ${pct(rtoken)}, target ${pct(ctx.book.targetRtokenPct)}, off by ${pct(drift)}`,
    };
  },
  "B2-drawdown": (ctx, p, cfg) => {
    const bookValue = Object.entries(ctx.book.positions).reduce(
      (sum, [sym, pos]) => sum + pos.qty * (ctx.pxOf.get(sym) ?? 0),
      ctx.book.usdt,
    );
    const openValue = ctx.book.openValue24h;
    if (!openValue || openValue <= 0) return { pass: null, measured: "no start-of-day portfolio value recorded" };
    const dd = (openValue - bookValue) / openValue;
    const increasesRisk = p.action === "shift" && p.to !== "USDT";
    return {
      pass: dd > cfg.knobs.drawdownMax && increasesRisk ? false : true,
      measured: `portfolio down ${pct(dd)} today (limit ${pct(cfg.knobs.drawdownMax)}); trade adds risk: ${increasesRisk}`,
    };
  },
  "B3-hedge-band": (ctx, p, cfg) => {
    const { crypto } = bookPct(ctx.book, ctx.pxOf);
    let projected: number;
    let touched = true;
    if (p.to === "crypto") projected = crypto + p.ratio * (1 - crypto);
    else if (p.from === "hedge-sleeve") projected = crypto * (1 - p.ratio);
    else {
      touched = false;
      projected = crypto;
    }
    return {
      pass: !touched || (projected >= cfg.knobs.hedgeBandMin && projected <= cfg.knobs.hedgeBandMax) ? true : false,
      measured: touched
        ? `after the trade: crypto would be ${pct(projected)} (band ${pct(cfg.knobs.hedgeBandMin)}-${pct(cfg.knobs.hedgeBandMax)})`
        : `crypto untouched at ${pct(crypto)}`,
    };
  },
  "B4-event": (ctx, _p, cfg) => {
    const cutoff = ctx.now - cfg.knobs.eventLookbackHours * 3600 * 1000;
    const hit = ctx.recentMacro.find((m) => m.ts >= cutoff && m.severity !== "low");
    return {
      pass: hit ? true : null,
      measured: hit
        ? `${severityWord(hit.severity)}: "${hit.headline.slice(0, 80)}" (${new Date(hit.ts).toISOString()})`
        : `no qualifying news in ${cfg.knobs.eventLookbackHours}h`,
    };
  },
  "B5-blackout": (ctx) => {
    const d = new Date(ctx.now);
    const minutesUTC = d.getUTCHours() * 60 + d.getUTCMinutes();
    const near = (m: number) => Math.abs(minutesUTC - m) <= 30;
    const blocked = near(14 * 60 + 30) || near(21 * 60);
    return { pass: blocked ? false : true, measured: `${d.toISOString().slice(11, 16)} UTC, quiet window 14:00-15:00 / 20:30-21:30` };
  },
  "B6-concentration": (ctx, p, cfg) => {
    const positions: Record<string, number> = {};
    for (const [sym, pos] of Object.entries(ctx.book.positions)) {
      positions[sym] = pos.qty * (ctx.pxOf.get(sym) ?? 0);
    }
    const totalNow = Object.values(positions).reduce((s, v) => s + v, ctx.book.usdt);
    if (totalNow <= 0) return { pass: null, measured: "portfolio value unmeasurable" };
    const buy = p.to === "crypto" || p.to === "rtoken-sleeve";
    const destSymbol = p.symbol ?? (p.to === "crypto" ? "BTCUSDT" : "RNVDAUSDT");
    const srcSymbol = p.from === "hedge-sleeve" ? "BTCUSDT" : "RNVDAUSDT";
    // mirror the executor's sizing: buys draw from cash, sells from the held position
    const notional = buy
      ? ctx.book.usdt * p.ratio
      : Math.max(0, positions[srcSymbol] ?? 0) * p.ratio;
    if (buy) {
      const destPx = ctx.pxOf.get(destSymbol);
      if (destPx === undefined) return { pass: null, measured: `no live price for ${symbolName(destSymbol)}` };
      positions[destSymbol] = (positions[destSymbol] ?? 0) + notional;
    } else {
      positions[srcSymbol] = (positions[srcSymbol] ?? 0) - notional;
    }
    let worst = { sym: "-", share: 0 };
    for (const [sym, value] of Object.entries(positions)) {
      const share = Math.max(0, value) / totalNow;
      if (share > worst.share) worst = { sym, share };
    }
    return {
      pass: worst.share > cfg.knobs.concentrationMax ? false : true,
      measured: `after the trade: largest holding ${symbolName(worst.sym)} at ${pct(worst.share)} (cap ${pct(cfg.knobs.concentrationMax)})`,
    };
  },
  "B7-stale": (ctx, _p, cfg) => {
    const stale = ctx.dataAgeMs > cfg.knobs.staleMaxSeconds * 1000;
    return { pass: stale ? false : true, measured: `market data ${Math.round(ctx.dataAgeMs / 1000)} seconds old (limit ${cfg.knobs.staleMaxSeconds})` };
  },
};

// Library rule implementations. Deterministic: they fail only on a measurable
// breach and never return null, so they never force a halt.
type LibraryMeasure = (ctx: PolicyContext, p: ProposalEvent, params: Record<string, number>) => MeasureResult;

const LIBRARY_MEASURES: Record<string, LibraryMeasure> = {
  "max-trades-per-day": (ctx, _p, params) => {
    const total = ctx.ordersToday + 1;
    return {
      pass: total > params.max ? false : true,
      measured: `${ctx.ordersToday} trades today; this would be #${total} (cap ${params.max})`,
    };
  },
  "min-cash-buffer": (ctx, p, params) => {
    const bookValue = Object.entries(ctx.book.positions).reduce(
      (sum, [sym, pos]) => sum + pos.qty * (ctx.pxOf.get(sym) ?? 0),
      ctx.book.usdt,
    );
    const buy = p.to === "crypto" || p.to === "rtoken-sleeve";
    const cashAfter = buy ? ctx.book.usdt * (1 - p.ratio) : ctx.book.usdt + ctx.book.usdt * p.ratio;
    const share = bookValue > 0 ? cashAfter / bookValue : 0;
    return {
      pass: buy && share < params.minPct / 100 ? false : true,
      measured: `cash after the trade: ${pct(share)} (floor ${params.minPct}%)`,
    };
  },
  "volatility-halt": (ctx, _p, params) => {
    let worst = { sym: "-", move: 0 };
    for (const [sym, pos] of Object.entries(ctx.book.positions)) {
      const move = Math.abs(ctx.chg24h.get(sym) ?? 0);
      if (move > worst.move) worst = { sym, move };
    }
    const breached = worst.move > params.maxMovePct / 100;
    return {
      pass: breached ? false : true,
      measured: breached
        ? `${symbolName(worst.sym)} moved ${pct(worst.move)} in 24h (halt at ${params.maxMovePct}%)`
        : `worst holding moved ${pct(worst.move)} in 24h (halt at ${params.maxMovePct}%)`,
    };
  },
  "daily-turnover-cap": (ctx, p, params) => {
    const projected = ctx.turnoverTodayUsdt + ctx.book.usdt * p.ratio;
    return {
      pass: projected > params.maxNotional ? false : true,
      measured: `$${Math.round(projected)} traded today (cap $${params.maxNotional})`,
    };
  },
};

interface ClauseRow {
  id: string;
  text: string;
  threshold: string;
  onUnmeasurable: string;
  measure: MeasureResult;
}

export async function evaluate(
  ctx: PolicyContext,
  proposal: ProposalEvent,
  proposalId: string,
  cfg?: PolicyConfig,
): Promise<VerdictEvent> {
  const config = cfg ?? (await readPolicyConfig());
  const rows: ClauseRow[] = [];

  // core guards: config order, honoring enabled
  for (const def of config.clauses) {
    if (!def.enabled) continue;
    const measure = CORE_MEASURES[def.id];
    if (!measure) continue;
    rows.push({ id: def.id, text: def.text, threshold: def.threshold, onUnmeasurable: def.onUnmeasurable, measure: measure(ctx, proposal, config) });
  }

  // library rules: config order, honoring enabled
  for (const def of config.library ?? []) {
    if (!def.enabled) continue;
    const measure = LIBRARY_MEASURES[def.type];
    if (!measure) continue;
    rows.push({ id: def.id, text: def.text, threshold: describeLibrary(def.type, def.params), onUnmeasurable: "deny", measure: measure(ctx, proposal, def.params) });
  }

  const clauses: ClauseVerdict[] = rows.map((r) => ({
    id: r.id,
    text: r.text,
    measured: r.measure.measured,
    threshold: r.threshold,
    pass: r.measure.pass,
  }));

  let result: VerdictEvent["result"];
  const denied = rows.some((r) => r.measure.pass === false);
  const unmeasured = rows.filter((r) => r.measure.pass === null);
  if (denied) result = "deny";
  else if (unmeasured.length === 0) result = "allow";
  else result = unmeasured.some((r) => r.onUnmeasurable === "deny") ? "deny" : "halt";

  return { kind: "verdict", proposalId, clauses, result, ts: ctx.now, policyVersion: config.version };
}

function describeLibrary(type: string, params: Record<string, number>): string {
  switch (type) {
    case "max-trades-per-day": return `<= ${params.max} trades/day`;
    case "min-cash-buffer": return `cash >= ${params.minPct}%`;
    case "volatility-halt": return `move <= ${params.maxMovePct}%`;
    case "daily-turnover-cap": return `<= $${params.maxNotional}/day`;
    default: return "-";
  }
}
