// Plain-language mapping layer. Every user-facing string renders through these
// helpers so a first-time visitor reads actions ("sold tokenized stocks for
// cash"), not sleeve codes. Rule codes (B1..B7) survive as secondary judge
// traceability: link hrefs, tooltips, muted sublines. Pure functions, no React,
// safe to import from server pages, client components, and the agent.
//   time = O(1) table lookups, space = O(1)

const SYMBOL_NAMES: Record<string, string> = {
  RNVDAUSDT: "tokenized Nvidia",
  RTSLAUSDT: "tokenized Tesla",
  RAAPLUSDT: "tokenized Apple",
  RMSFTUSDT: "tokenized Microsoft",
  RSPYUSDT: "tokenized S&P 500 fund",
  RQQQUSDT: "tokenized Nasdaq fund",
  BTCUSDT: "bitcoin",
  ETHUSDT: "ethereum",
  USDT: "cash",
};

export function symbolName(sym: string): string {
  if (SYMBOL_NAMES[sym]) return SYMBOL_NAMES[sym];
  return sym.endsWith("USDT") ? `${sym.slice(0, -4)} (token)` : sym;
}

// Sleeve codes as stored in the ledger's proposal.from / proposal.to.
export function sleeveName(s: string): string {
  switch (s) {
    case "rtoken-sleeve":
      return "tokenized stocks";
    case "usdt-buffer":
      return "cash";
    case "crypto":
    case "hedge-sleeve":
      return "crypto";
    default:
      return s.replace(/-/g, " ");
  }
}

const SHIFT_PHRASES: Record<string, string> = {
  "rtoken-sleeve|usdt-buffer": "sold tokenized stocks for cash",
  "rtoken-sleeve|crypto": "swapped tokenized stocks for crypto",
  "usdt-buffer|crypto": "bought crypto with spare cash",
  "usdt-buffer|rtoken-sleeve": "bought tokenized stocks with cash",
  "crypto|usdt-buffer": "sold crypto for cash",
  "crypto|rtoken-sleeve": "swapped crypto for tokenized stocks",
};

// "sold tokenized stocks for cash" from ("rtoken-sleeve", "usdt-buffer").
export function shiftPhrase(from: string, to: string): string {
  return SHIFT_PHRASES[`${from}|${to}`] ?? `moved ${sleeveName(from)} into ${sleeveName(to)}`;
}

// Short human name for a rule, usable mid-sentence: "the news rule said no".
export function ruleName(id: string): string {
  const NAMES: Record<string, string> = {
    "B1-drift": "the target-mix rule",
    "B2-drawdown": "the bad-day rule",
    "B3-hedge-band": "the crypto-band rule",
    "B4-event": "the news rule",
    "B5-blackout": "the quiet-hours rule",
    "B6-concentration": "the size-cap rule",
    "B7-stale": "the old-data rule",
    "max-trades-per-day": "the trade-count rule",
    "min-cash-buffer": "the cash-floor rule",
    "volatility-halt": "the big-swing rule",
    "daily-turnover-cap": "the daily-limit rule",
  };
  return NAMES[id] ?? `the ${id.replace(/-/g, " ")} rule`;
}

// What a blocking rule objected to (or could not verify): reads after
// "blocked because ..." on a deny and stays truthful on a halt, where the
// rule blocked because its number was missing, not because it measured bad.
export function clauseReason(id: string): string {
  const REASONS: Record<string, string> = {
    "B1-drift": "the portfolio was already close to its target mix",
    "B2-drawdown": "the day was already in the red",
    "B3-hedge-band": "crypto would land outside its allowed range",
    "B4-event": "no news was big enough to justify a trade",
    "B5-blackout": "it was too close to the US market open or close",
    "B6-concentration": "one holding would end up too big",
    "B7-stale": "market prices were too old to trust",
    "max-trades-per-day": "the day's trade limit was reached",
    "min-cash-buffer": "cash would drop below its safety floor",
    "volatility-halt": "markets were swinging too hard",
    "daily-turnover-cap": "the day's trading budget was spent",
  };
  return REASONS[id] ?? `${ruleName(id)} said no`;
}

export const VERDICT_WORDS: Record<string, string> = {
  allow: "allowed",
  deny: "denied",
  halt: "stopped",
};

export function verdictWord(r: string): string {
  return VERDICT_WORDS[r] ?? r;
}

// Ledger kinds as a normie reads them (log filter chips + row labels).
export const KIND_LABELS: Record<string, string> = {
  all: "everything",
  macro: "news",
  market: "prices",
  proposal: "trade idea",
  verdict: "decision",
  order: "order",
  fill: "fill",
  correction: "correction",
  sensor_error: "sensor error",
  runner_error: "runner error",
};

export function kindLabel(k: string): string {
  return KIND_LABELS[k] ?? k;
}

// Proposer ids as a normie reads them.
export function proposerName(p: string): string {
  if (p === "threshold-fallback") return "built-in logic";
  if (p === "llm" || p === "qwen") return "AI model";
  return p;
}

// Order execution modes as a normie reads them.
export function executionLabel(e: string): string {
  if (e === "paper") return "practice";
  if (e === "simulated") return "simulated fill";
  return e;
}

// Macro severity as a normie reads it.
export function severityWord(s: string): string {
  return s === "high" ? "big story" : s === "medium" ? "notable story" : "small story";
}
