// Sensor: one keyless bulk fetch per tick (verified Sep 9: Bitget v2 rejects
// multi-symbol queries with 40034; the no-param call returns every symbol).
//   time = O(s + w), space = O(w)   s = all symbols (~1300), w = watchlist (~8)
//   structure: Set<string> for O(1) watchlist membership inside the scan
//   family: linear scan with hashed lookup

import type { MarketEvent, MarketKind } from "./types";

const BASE = "https://api.bitget.com";

export const WATCHLIST: Record<string, MarketKind> = {
  RNVDAUSDT: "rtoken",
  RTSLAUSDT: "rtoken",
  RAAPLUSDT: "rtoken",
  RMSFTUSDT: "rtoken",
  RSPYUSDT: "rtoken",
  RQQQUSDT: "rtoken",
  BTCUSDT: "crypto",
  ETHUSDT: "crypto",
};

interface RawTicker {
  symbol: string;
  lastPr: string;
  change24h: string;
  ts: string;
}

export async function senseMarkets(
  now: number,
): Promise<{ events: MarketEvent[]; error?: string }> {
  const watch = new Set(Object.keys(WATCHLIST));
  try {
    const res = await fetch(`${BASE}/api/v2/spot/market/tickers`, {
      cache: "no-store",
    });
    if (!res.ok) return { events: [], error: `tickers HTTP ${res.status}` };
    const body = (await res.json()) as { code: string; data?: RawTicker[] };
    if (body.code !== "00000" || !body.data)
      return { events: [], error: `tickers code ${body.code}` };
    const events: MarketEvent[] = [];
    for (const t of body.data) {
      if (!watch.has(t.symbol)) continue;
      const px = Number(t.lastPr);
      const chg = Number(t.change24h);
      if (!Number.isFinite(px) || px <= 0) continue; // NaN/0 guard: skip, never fabricate
      events.push({
        kind: "market",
        symbol: t.symbol,
        market: WATCHLIST[t.symbol],
        px,
        chg24h: Number.isFinite(chg) ? chg : 0,
        ts: now,
      });
    }
    if (events.length === 0) return { events: [], error: "no watchlist rows in response" };
    return { events };
  } catch (e) {
    return { events: [], error: `tickers fetch failed: ${String(e).slice(0, 120)}` };
  }
}
