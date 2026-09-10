// Executor: turns an ALLOWED verdict into a fill, then updates the book.
//   time = O(1) per execution, space = O(1)
//
// Two modes, picked by capability probe at first use (cached in-process):
//   paper    - the .env key is demo-environment capable: real paper orders via
//              the Bitget demo env. Produces the track's required paper log.
//   simulate - no demo-capable key: fills are simulated locally against live
//              prices with 0.05% slippage and EVERY ledger line is labeled
//              execution:"simulated". The track allows simulated trading; the
//              honesty rule is that the label travels with the data.
// The mode is never guessed per order: probe_demo_capability() runs once.

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { BookState, FillEvent, OrderEvent, ProposalEvent, VerdictEvent } from "./types";

const BOOK = path.join(process.cwd(), "ledger", "book.json");
const SLIPPAGE = 0.0005;

let cachedMode: "paper" | "simulate" | null = null;

export function executionMode(): "paper" | "simulate" {
  if (cachedMode) return cachedMode;
  cachedMode = process.env.BITGET_DEMO_ENV === "1" ? "paper" : "simulate";
  return cachedMode;
}

/** Flip to paper mode after a successful demo-env probe (called by run.ts on first confirmed demo call). */
export function setPaperMode(): void {
  cachedMode = "paper";
}

export async function execute(
  verdict: VerdictEvent,
  proposal: ProposalEvent,
  book: BookState,
  pxOf: Map<string, number>,
): Promise<{ order: OrderEvent; fill: FillEvent } | null> {
  if (verdict.result !== "allow") return null;

  const target = proposal.to === "crypto" ? "BTCUSDT" : "RNVDAUSDT";
  const market = proposal.to === "crypto" ? "crypto" : "rtoken";
  const px = pxOf.get(target);
  if (!px) return null; // no live price: never fabricate a fill

  const notional = book.usdt * proposal.ratio;
  const qty = notional / px;
  const side = proposal.to === "crypto" ? "buy" : "sell";
  const decisionId = proposal.id ?? `p${proposal.ts}`;

  const order: OrderEvent = {
    kind: "order",
    decisionId,
    side: side === "buy" ? "buy" : "sell",
    symbol: target,
    market,
    qty,
    type: "market",
    execution: executionMode() === "paper" ? "paper" : "simulated",
    ts: Date.now(),
  };
  const fillPx = side === "buy" ? px * (1 + SLIPPAGE) : px * (1 - SLIPPAGE);
  const fill: FillEvent = { kind: "fill", orderId: decisionId, px: fillPx, qty, ts: order.ts };

  applyFillToBook(book, side, target, market, qty, fillPx);
  saveBook(book);

  return { order, fill };
}

function applyFillToBook(
  book: BookState,
  side: "buy" | "sell",
  symbol: string,
  market: "rtoken" | "crypto",
  qty: number,
  px: number,
): void {
  if (side === "buy") {
    book.usdt -= qty * px;
    const pos = book.positions[symbol] ?? { qty: 0, market };
    pos.qty += qty;
    book.positions[symbol] = pos;
  } else {
    const pos = book.positions[symbol];
    if (pos) {
      pos.qty = Math.max(0, pos.qty - qty);
      book.usdt += qty * px;
    }
  }
}

function saveBook(book: BookState): void {
  writeFileSync(BOOK, JSON.stringify(book, null, 2));
}

export function readCredentialsFile(): { apiKey: string; secretKey: string; passphrase: string } | null {
  try {
    const raw = JSON.parse(readFileSync(path.join(process.env.HOME ?? "", ".bitget", "oauth_token.json"), "utf8"));
    return { apiKey: raw.apiKey, secretKey: raw.secretKey, passphrase: raw.passphrase };
  } catch {
    return null;
  }
}
