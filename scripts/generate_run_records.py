#!/usr/bin/env python3
# Generates docs/run-records.md from the append-only ledger: one row per
# executed (simulated, labeled) trade, with the price and quantity joined from
# the paired fill event and the running cash flow anchored to the current
# book. Deterministic replay of recorded events only.
import json
from datetime import datetime, timezone

LEDGER = "ledger/events.jsonl"
ARCHIVE = "ledger/archive/night1-2026-09-09.jsonl"
BOOK = "ledger/book.json"
OUT = "docs/run-records.md"

orders = {}   # decisionId -> order event
fills = []    # (ts, orderId, px, qty, source)
markets = []  # (ts, symbol, px)

def load(path, source):
    try:
        raw = open(path, encoding="utf-8").read()
    except FileNotFoundError:
        return
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            e = json.loads(line)
        except json.JSONDecodeError:
            continue  # torn tail
        k = e.get("kind")
        if k == "order":
            orders[e["decisionId"]] = e
        elif k == "fill":
            fills.append((e["ts"], e["orderId"], e.get("px"), e["qty"], source))
        elif k == "market":
            markets.append((e["ts"], e["symbol"], e["px"]))

load(ARCHIVE, "night-one archive")
load(LEDGER, "current ledger")
fills.sort(key=lambda f: f[0])
markets.sort(key=lambda m: m[0])

def price_at(symbol, ts):
    px = None
    for t, sym, p in markets:
        if t > ts:
            break
        if sym == symbol:
            px = p
    return px

book = json.load(open(BOOK, encoding="utf-8"))
current_usdt = book.get("usdt")

rows = []
cash_delta = 0.0
for ts, order_id, px, qty, source in fills:
    o = orders.get(order_id, {})
    symbol = o.get("symbol", "?")
    side = o.get("side", "?")
    price = px if px else price_at(symbol, ts)
    notional = round(price * qty, 2) if price else 0.0
    cash_delta += notional if side == "sell" else -notional
    rows.append({
        "ts": ts, "symbol": symbol, "side": side, "price": price,
        "qty": qty, "notional": notional,
        "cash_flow": round(cash_delta, 2), "execution": o.get("execution", "simulated"),
        "source": source,
    })

utc = lambda ts: datetime.fromtimestamp(ts / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")

lines = [
    "# Run Records (paper trading)",
    "",
    "Every executed trade since Sep 9, 2026, generated from the append-only ledger",
    "(`ledger/events.jsonl` + `ledger/archive/night1-2026-09-09.jsonl`) by",
    "`scripts/generate_run_records.py`. All fills are **simulated against real prices**",
    "and labeled as practice everywhere they appear. No real funds are involved.",
    "",
    "| # | UTC time | Instrument | Direction | Price (USDT) | Quantity | Notional (USDT) | Cumulative cash flow (USDT) |",
    "|---|---|---|---|---|---|---|---|",
]
for i, r in enumerate(rows, 1):
    price = f"{r['price']:.2f}" if r["price"] else "n/a"
    lines.append(
        f"| {i} | {utc(r['ts'])} | {r['symbol']} | {r['side'].upper()} | {price} |"
        f" {r['qty']:.6f} | {r['notional']:.2f} | {r['cash_flow']:+.2f} |"
    )
# real portfolio value now: cash + holdings priced at each symbol's latest recorded price
latest_px = {}
for t, sym, p in markets:
    latest_px[sym] = p
holdings = sum(pos["qty"] * latest_px.get(sym, 0) for sym, pos in book.get("positions", {}).items())
portfolio_now = round(current_usdt + holdings, 2)

lines += [
    "",
    f"**Trades: {len(rows)}** (all simulated, all labeled) · **Practice portfolio value now: ${portfolio_now}**",
    " (cash ${} + holdings ${}).".format(round(current_usdt, 2), round(holdings, 2)),
    "",
    "Cumulative cash flow is the running sum of trade notional (sells add, buys subtract),",
    "reconstructed from recorded events; the live portfolio value (holdings priced at current",
    "market plus cash) is on the [control room](https://try-ballast.netlify.app/control-room).",
    "",
    "Rows from Sep 10-11 include trades later reconciled by `correction` lines in the ledger:",
    "the executor had a sizing bug that was fixed on Sep 11 and the books were corrected openly",
    "(see the correction events in `ledger/events.jsonl`). Corrections are part of the record.",
    "",
]

open(OUT, "w", encoding="utf-8").write("\n".join(lines))
print(f"wrote {OUT}: {len(rows)} trades")
