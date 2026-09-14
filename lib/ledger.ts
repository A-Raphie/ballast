// Server-side ledger reader for the UI. One pass over events.jsonl:
//   time = O(n), space = O(n)   n = ledger lines (~10^3-10^4 over the event)
//   structure: single pass building derived maps (decisions, market snapshot)
//   family: linear scan with grouping

import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  LedgerEvent,
  MacroEvent,
  MarketEvent,
  ProposalEvent,
  VerdictEvent,
  OrderEvent,
} from "@/agent/types";

export interface Decision {
  id: string;
  proposal?: ProposalEvent;
  verdict?: VerdictEvent;
  order?: OrderEvent;
  ts: number;
  failing?: string[]; // clause ids that failed (deny) or blocked (halt), for one-glance reasons
}

export interface LedgerView {
  events: LedgerEvent[];
  decisions: Decision[];
  marketSnapshot: MarketEvent[];
  macroEvents: MacroEvent[];
  clauseStats: Record<string, { pass: number; fail: number; halt: number }>;
  bookValue: number | null;
  sensingSince: number | null;
  exposure: { rtokenPct: number; cryptoPct: number; usdtPct: number } | null;
  heelPct: number | null;
  lastTickTs: number | null;
  policyVersion: string | null;
  priceSeries: Record<string, { ts: number; px: number }[]>;
}

async function firstTickTs(): Promise<number | null> {
  // sensing began Sep 9 (night one lives in ledger/archive/); fall back to the
  // current ledger's first line
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "ledger", "archive", "night1-2026-09-09.jsonl"), "utf8");
    const first = JSON.parse(raw.split("\n")[0]);
    return first.ts ?? null;
  } catch {
    return null;
  }
}

export async function readLedger(): Promise<LedgerView> {
  let raw: string;
  try {
    raw = await fs.readFile(path.join(process.cwd(), "ledger", "events.jsonl"), "utf8");
  } catch {
    return emptyView();
  }
  const events: LedgerEvent[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line));
    } catch {
      /* torn tail: display the honest gap */
    }
  }
  events.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0));

  const decisions = new Map<string, Decision>();
  const clauseStats: LedgerView["clauseStats"] = {};
  let lastTickTs: number | null = null;

  for (const e of events) {
    if (e.kind === "proposal") {
      const p = e as ProposalEvent;
      const id = p.id ?? `p${p.ts}`;
      decisions.set(id, { id, proposal: p, ts: p.ts });
    } else if (e.kind === "verdict") {
      const v = e as VerdictEvent;
      const d = decisions.get(v.proposalId) ?? { id: v.proposalId, ts: v.ts };
      d.verdict = v;
      d.failing = v.clauses.filter((c) => c.pass === false).map((c) => c.id);
      if (v.result === "halt") d.failing = v.clauses.filter((c) => c.pass === null).map((c) => c.id);
      decisions.set(v.proposalId, d);
      for (const c of v.clauses) {
        const s = (clauseStats[c.id] ??= { pass: 0, fail: 0, halt: 0 });
        if (c.pass === true) s.pass++;
        else if (c.pass === false) s.fail++;
        else s.halt++;
      }
    } else if (e.kind === "order") {
      const o = e as OrderEvent;
      const d = decisions.get(o.decisionId) ?? { id: o.decisionId, ts: o.ts };
      d.order = o;
      decisions.set(o.decisionId, d);
    } else if (e.kind === "market" || e.kind === "macro") {
      lastTickTs = Math.max(lastTickTs ?? 0, e.ts);
    }
  }

  // market snapshot: latest row per symbol (Map for O(1) upsert in the scan)
  const latest = new Map<string, MarketEvent>();
  // first price per symbol inside the current UTC day anchors the day move
  const openPx = new Map<string, number>();
  const dayStart = Math.floor(Date.now() / 86400000) * 86400000;
  // last-24h price series per symbol feeds the control-room sparklines
  const seriesRaw = new Map<string, { ts: number; px: number }[]>();
  const seriesSince = Date.now() - 24 * 3600 * 1000;
  let macroEvents: MacroEvent[] = [];
  for (const e of events) {
    if (e.kind === "market") {
      const m = e as MarketEvent;
      latest.set(m.symbol, m); // sorted scan: later rows overwrite
      if (m.ts >= dayStart && !openPx.has(m.symbol)) openPx.set(m.symbol, m.px);
      if (m.ts >= seriesSince) {
        const arr = seriesRaw.get(m.symbol) ?? [];
        arr.push({ ts: m.ts, px: m.px });
        seriesRaw.set(m.symbol, arr);
      }
    } else if (e.kind === "macro") {
      macroEvents.push(e as MacroEvent);
    }
  }
  macroEvents = macroEvents.slice(-60);

  const book = await readBook();
  const policyJson = await readPolicyVersion();
  const view = emptyView();
  view.sensingSince = await firstTickTs();
  view.events = events;
  view.decisions = [...decisions.values()].sort((a, b) => b.ts - a.ts);
  view.marketSnapshot = [...latest.values()];
  view.macroEvents = macroEvents;
  view.clauseStats = clauseStats;
  view.lastTickTs = lastTickTs;
  view.policyVersion = policyJson;

  if (book) {
    let rtoken = 0;
    let crypto = 0;
    const positions: [string, { qty: number; market: "rtoken" | "crypto" }][] = Object.entries(book.positions ?? {});
    for (const [sym, pos] of positions) {
      const px = latest.get(sym)?.px;
      if (px === undefined) continue;
      const v = pos.qty * px;
      if (pos.market === "rtoken") rtoken += v;
      else crypto += v;
    }
    const total = rtoken + crypto + book.usdt;
    if (total > 0) {
      view.exposure = { rtokenPct: rtoken / total, cryptoPct: crypto / total, usdtPct: book.usdt / total };
      view.bookValue = total;
    }
    // Day move, priced not remembered: hold TODAY'S positions at each symbol's
    // first price of the UTC day vs now. The book's own openValue24h predates
    // ledger corrections, so comparing against it produced phantom ±400% days.
    if (total > 0 && openPx.size > 0) {
      let openVal = book.usdt;
      let pricedFully = true;
      for (const [sym, pos] of positions) {
        const open = openPx.get(sym);
        if (open === undefined) { pricedFully = false; break; }
        openVal += pos.qty * open;
      }
      if (pricedFully && openVal > 0) {
        view.heelPct = ((total - openVal) / openVal) * 100;
      }
    }
    // fallback to the book baseline only when today's prices are incomplete;
    // either way a result beyond ±50% means a corrupted baseline, not a market
    if (view.heelPct === null && typeof book.openValue24h === "number" && book.openValue24h > 0 && total > 0) {
      const heel = ((total - book.openValue24h) / book.openValue24h) * 100;
      if (Math.abs(heel) <= 50) view.heelPct = heel;
    }
    if (view.heelPct !== null && Math.abs(view.heelPct) > 50) view.heelPct = null;
  }
  view.priceSeries = {};
  for (const [sym, points] of seriesRaw) {
    view.priceSeries[sym] = downsample(points, 24);
  }
  return view;
}

// Even-index downsampling keeps the sparkline shape at a bounded point count.
export function downsample<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: T[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

async function readBook(): Promise<any | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(process.cwd(), "ledger", "book.json"), "utf8"));
  } catch {
    return null;
  }
}

async function readPolicyVersion(): Promise<string | null> {
  try {
    const p = JSON.parse(await fs.readFile(path.join(process.cwd(), "policy", "policy.json"), "utf8"));
    return p.version ?? null;
  } catch {
    return null;
  }
}

function emptyView(): LedgerView {
  return {
    events: [],
    decisions: [],
    marketSnapshot: [],
    macroEvents: [],
    clauseStats: {},
    bookValue: null,
    sensingSince: null,
    exposure: null,
    heelPct: null,
    lastTickTs: null,
    policyVersion: null,
    priceSeries: {},
  };
}
