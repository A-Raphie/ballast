export type MarketKind = "rtoken" | "crypto";

export interface MarketEvent {
  kind: "market";
  symbol: string;
  market: MarketKind;
  px: number;
  chg24h: number;
  ts: number;
}

export interface MacroEvent {
  kind: "macro";
  source: string;
  headline: string;
  severity: "low" | "medium" | "high";
  assetsAffected: string[];
  ts: number;
}

export interface ProposalEvent {
  kind: "proposal";
  id?: string; // decision id; verdicts and orders link back via this
  symbol?: string; // concrete instrument when the destination sleeve maps to one
  proposer: "llm" | "threshold-fallback";
  action: "shift";
  from: string;
  to: string;
  ratio: number;
  reason: string;
  ts: number;
}

export interface ClauseVerdict {
  id: string;
  text: string;
  measured: string;
  threshold: string;
  pass: boolean | null; // null = unmeasurable this tick (e.g. no data)
}

export interface VerdictEvent {
  kind: "verdict";
  proposalId: string;
  clauses: ClauseVerdict[];
  result: "allow" | "deny" | "halt";
  policyVersion?: string;
  ts: number;
}

export interface PolicyChangeEvent {
  kind: "policy_change";
  version: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  ts: number;
}

export interface OrderEvent {
  kind: "order";
  decisionId: string;
  side: "buy" | "sell";
  symbol: string;
  market: MarketKind;
  qty: number;
  type: "market";
  execution: "paper" | "pending-key" | "simulated";
  ts: number;
}

export interface FillEvent {
  kind: "fill";
  orderId: string;
  px: number;
  qty: number;
  ts: number;
}

export interface ShiftEvent {
  kind: "shift";
  decisionId: string;
  moved: { fromBook: string; toBook: string; notional: number };
  exposureAfter: { rtokenPct: number; cryptoPct: number; usdtPct: number };
  ts: number;
}

export interface ErrorEvent {
  kind: "sensor_error" | "runner_error" | "correction";
  detail: string;
  ts: number;
}

export type LedgerEvent =
  | MarketEvent
  | MacroEvent
  | ProposalEvent
  | VerdictEvent
  | OrderEvent
  | FillEvent
  | ShiftEvent
  | PolicyChangeEvent
  | ErrorEvent;

export interface BookState {
  usdt: number;
  positions: Record<string, { qty: number; market: MarketKind }>;
  targetRtokenPct: number; // written policy target for the rToken sleeve
  targetHedgePct: number; // written policy target for the crypto hedge sleeve
  openValue24h?: number; // book value at the current UTC day open (B2 baseline)
  openDay?: number; // UTC day index the openValue belongs to
  updatedAt: number;
}
