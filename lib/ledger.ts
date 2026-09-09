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
}

export interface LedgerView {
  events: LedgerEvent[];
  decisions: Decision[];
  marketSnapshot: MarketEvent[];
  macroEvents: MacroEvent[];
  clauseStats: Record<string, { pass: number; fail: number; halt: number }>;
  bookValue: number | null;
  exposure: { rtokenPct: number; cryptoPct: number; usdtPct: number } | null;
  heelPct: number | null;
  lastTickTs: number | null;
  policyVersion: string | null;
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
  let macroEvents: MacroEvent[] = [];
  for (const e of events) {
    if (e.kind === "market") {
      const m = e as MarketEvent;
      latest.set(m.symbol, m); // sorted scan: later rows overwrite
    } else if (e.kind === "macro") {
      macroEvents.push(e as MacroEvent);
    }
  }
  macroEvents = macroEvents.slice(-60);

  const book = await readBook();
  const policyJson = await readPolicyVersion();
  const view = emptyView();
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
    if (typeof book.openValue24h === "number" && book.openValue24h > 0 && total > 0) {
      view.heelPct = ((book.openValue24h - total) / book.openValue24h) * 100;
    }
  }
  return view;
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
    exposure: null,
    heelPct: null,
    lastTickTs: null,
    policyVersion: null,
  };
}
