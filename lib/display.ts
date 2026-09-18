// Plain-language mapping layer. Every user-facing string renders through these
// helpers so a first-time visitor reads actions ("sold tokenized stocks for
// cash"), not sleeve codes. Rule codes (B1..B7) survive as secondary judge
// traceability: link hrefs, tooltips, muted sublines. Pure functions, no React,
// safe to import from server pages, client components, and the agent.
//   time = O(1) table lookups, space = O(1)

// Data surfaces show the human pair convention (BTC/USDT); the API symbol
// stays raw everywhere data is stored or sent. symbolHint keeps the friendly
// expansion for hover tooltips only.
export function symbolName(sym: string): string {
  return sym.length > 4 && sym.endsWith("USDT") ? `${sym.slice(0, -4)}/USDT` : sym;
}

const SYMBOL_HINTS: Record<string, string> = {
  RNVDAUSDT: "Nvidia as a tokenized US stock",
  RTSLAUSDT: "Tesla as a tokenized US stock",
  RAAPLUSDT: "Apple as a tokenized US stock",
  RMSFTUSDT: "Microsoft as a tokenized US stock",
  RSPYUSDT: "S&P 500 fund as a tokenized US stock",
  RQQQUSDT: "Nasdaq fund as a tokenized US stock",
  BTCUSDT: "bitcoin, priced in USDT",
  ETHUSDT: "ethereum, priced in USDT",
  USDT: "cash",
};

export function symbolHint(sym: string): string {
  if (SYMBOL_HINTS[sym]) return SYMBOL_HINTS[sym];
  return sym.endsWith("USDT") ? `${sym.slice(0, -4)} as a tokenized US stock` : sym;
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
// Library instances carry generated ids like "L3-max-trades-per-day"; map them
// by their type suffix so visitors never see the L-number.
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
  if (NAMES[id]) return NAMES[id];
  const suffix = Object.keys(NAMES).find((k) => id.endsWith(k));
  if (suffix) return NAMES[suffix];
  return `the ${id.replace(/^L\d+-/, "").replace(/-/g, " ")} rule`;
}

// Sentence-case a plain phrase without title-casing every word (CSS capitalize
// renders "Sold Tokenized Stocks For Cash"; this renders "Sold tokenized ...").
export function sentence(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

// Ledger kinds as the log filter chips + row labels read them.
export const KIND_LABELS: Record<string, string> = {
  all: "Everything",
  macro: "News",
  market: "Prices",
  proposal: "Trade idea",
  verdict: "Decision",
  order: "Order",
  fill: "Fill",
  correction: "Correction",
  sensor_error: "Sensor error",
  runner_error: "Runner error",
};

export function kindLabel(k: string): string {
  return KIND_LABELS[k] ?? k;
}

// Proposer ids as a normie reads them.
export function proposerName(p: string): string {
  if (p === "threshold-fallback") return "Built-in logic";
  if (p === "llm" || p === "qwen") return "AI model";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

// Order execution modes as a normie reads them.
export function executionLabel(e: string): string {
  if (e === "paper") return "Practice";
  if (e === "simulated") return "Simulated fill";
  return e.charAt(0).toUpperCase() + e.slice(1);
}

// Macro severity as a normie reads it.
export function severityWord(s: string): string {
  return s === "high" ? "Big story" : s === "medium" ? "Notable story" : "Small story";
}

// RSS headlines arrive with XML entities intact ("S&amp;P"); the log and the
// band tooltips decode the handful that matter instead of shipping raw markup.
export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}
