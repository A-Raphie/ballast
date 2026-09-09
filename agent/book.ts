// Book state: the paper book. Loaded from ledger/book.json; a single writer
// (the tick) mutates it. time = O(p), p = positions (<=8).

import { promises as fs } from "node:fs";
import path from "node:path";
import type { BookState } from "./types";

const BOOK = path.join(process.cwd(), "ledger", "book.json");

export const DEFAULT_BOOK: BookState = {
  usdt: 10_000,
  positions: {},
  targetRtokenPct: 0.65,
  targetHedgePct: 0.25,
  openValue24h: undefined,
  updatedAt: 0,
};

export async function loadBook(now: number): Promise<BookState> {
  let book = DEFAULT_BOOK;
  try {
    book = { ...DEFAULT_BOOK, ...JSON.parse(await fs.readFile(BOOK, "utf8")) };
  } catch {
    /* first run: write the default */
  }
  // roll the 24h-open reference at each UTC day boundary (B2-drawdown baseline)
  const day = Math.floor(now / 86_400_000);
  if (book.openDay !== day) {
    book.openDay = day;
    book.openValue24h = bookValue(book, new Map());
  }
  book.updatedAt = now;
  return book;
}

export function bookValue(book: BookState, pxOf: Map<string, number>): number {
  let v = book.usdt;
  for (const [sym, pos] of Object.entries(book.positions)) {
    const px = pxOf.get(sym);
    if (px !== undefined) v += pos.qty * px;
  }
  return v;
}

export function bookPctFrom(book: BookState, pxOf: Map<string, number>): { rtoken: number; crypto: number } {
  let rtoken = 0;
  let crypto = 0;
  for (const [sym, pos] of Object.entries(book.positions)) {
    const px = pxOf.get(sym);
    if (px === undefined) continue;
    const v = pos.qty * px;
    if (pos.market === "rtoken") rtoken += v;
    else crypto += v;
  }
  const total = rtoken + crypto + book.usdt;
  if (total <= 0) return { rtoken: 0, crypto: 0 };
  return { rtoken: rtoken / total, crypto: crypto / total };
}

export async function saveBook(book: BookState): Promise<void> {
  await fs.mkdir(path.dirname(BOOK), { recursive: true });
  await fs.writeFile(BOOK, JSON.stringify(book, null, 2));
}
