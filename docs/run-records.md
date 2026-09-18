# Run Records (paper trading)

Every executed trade since Sep 9, 2026, generated from the append-only ledger
(`ledger/events.jsonl` + `ledger/archive/night1-2026-09-09.jsonl`) by
`scripts/generate_run_records.py`. All fills are **simulated against real prices**
and labeled as practice everywhere they appear. No real funds are involved.

| # | UTC time | Instrument | Direction | Price (USDT) | Quantity | Notional (USDT) | Cumulative cash flow (USDT) |
|---|---|---|---|---|---|---|---|
| 1 | 2026-09-10 21:31 | BTCUSDT | BUY | 77253.61 | 0.032377 | 2501.25 | -2501.25 |
| 2 | 2026-09-10 22:31 | RNVDAUSDT | SELL | 218.49 | 10.291057 | 2248.50 | -252.75 |
| 3 | 2026-09-10 23:31 | RNVDAUSDT | SELL | 218.16 | 10.306616 | 2248.50 | +1995.75 |
| 4 | 2026-09-11 00:32 | RNVDAUSDT | SELL | 218.09 | 10.309922 | 2248.50 | +4244.25 |
| 5 | 2026-09-11 01:32 | RNVDAUSDT | SELL | 218.47 | 10.291998 | 2248.50 | +6492.75 |
| 6 | 2026-09-11 02:32 | RNVDAUSDT | SELL | 218.19 | 10.305199 | 2248.50 | +8741.25 |
| 7 | 2026-09-11 03:32 | RNVDAUSDT | SELL | 218.05 | 10.311812 | 2248.50 | +10989.75 |
| 8 | 2026-09-11 04:32 | RNVDAUSDT | SELL | 218.36 | 10.297180 | 2248.50 | +13238.25 |
| 9 | 2026-09-11 05:32 | RNVDAUSDT | SELL | 218.45 | 10.292940 | 2248.50 | +15486.75 |
| 10 | 2026-09-11 06:32 | RNVDAUSDT | SELL | 219.32 | 10.252131 | 2248.50 | +17735.25 |
| 11 | 2026-09-11 07:33 | RNVDAUSDT | SELL | 219.63 | 10.237667 | 2248.50 | +19983.75 |
| 12 | 2026-09-11 08:33 | RNVDAUSDT | SELL | 220.12 | 10.214889 | 2248.50 | +22232.25 |
| 13 | 2026-09-11 09:33 | RNVDAUSDT | SELL | 220.16 | 10.213034 | 2248.50 | +24480.75 |
| 14 | 2026-09-11 10:13 | RNVDAUSDT | SELL | 220.19 | 10.211643 | 2248.50 | +26729.25 |
| 15 | 2026-09-11 10:15 | BTCUSDT | BUY | 77138.55 | 0.032425 | 2501.25 | +24228.00 |
| 16 | 2026-09-11 11:18 | RNVDAUSDT | BUY | 220.06 | 10.227893 | 2250.75 | +21977.25 |
| 17 | 2026-09-11 12:19 | RNVDAUSDT | BUY | 219.61 | 7.172665 | 1575.19 | +20402.06 |
| 18 | 2026-09-11 19:08 | RNVDAUSDT | SELL | 218.91 | 1.658492 | 363.06 | +20765.12 |
| 19 | 2026-09-11 19:08 | RTSLAUSDT | BUY | 364.48 | 3.323531 | 1211.37 | +19553.75 |
| 20 | 2026-09-11 20:20 | RNVDAUSDT | SELL | 218.24 | 1.935173 | 422.33 | +19976.08 |
| 21 | 2026-09-11 22:21 | RAAPLUSDT | BUY | 332.78 | 2.208835 | 735.05 | +19241.03 |
| 22 | 2026-09-11 22:42 | RNVDAUSDT | SELL | 218.07 | 1.069516 | 233.23 | +19474.26 |
| 23 | 2026-09-11 23:53 | RMSFTUSDT | BUY | 494.80 | 0.977617 | 483.72 | +18990.54 |
| 24 | 2026-09-12 00:53 | RNVDAUSDT | SELL | 218.28 | 0.734301 | 160.28 | +19150.82 |
| 25 | 2026-09-12 01:53 | RSPYUSDT | BUY | 764.72 | 0.455287 | 348.17 | +18802.65 |
| 26 | 2026-09-12 02:53 | RNVDAUSDT | SELL | 218.64 | 0.547667 | 119.74 | +18922.39 |
| 27 | 2026-09-12 03:54 | RQQQUSDT | BUY | 715.95 | 0.369778 | 264.74 | +18657.65 |
| 28 | 2026-09-14 09:44 | RNVDAUSDT | SELL | 211.74 | 2.714620 | 574.80 | +19232.45 |
| 29 | 2026-09-14 10:44 | RQQQUSDT | BUY | 704.35 | 0.562180 | 395.97 | +18836.48 |
| 30 | 2026-09-14 11:44 | RNVDAUSDT | SELL | 213.04 | 0.242254 | 51.61 | +18888.09 |
| 31 | 2026-09-14 12:45 | RSPYUSDT | BUY | 759.48 | 0.349121 | 265.15 | +18622.94 |

**Trades: 31** (all simulated, all labeled) · **Practice portfolio value now: $10136.47**
 (cash $1893.71 + holdings $8242.76).

Cumulative cash flow is the running sum of trade notional (sells add, buys subtract),
reconstructed from recorded events; the live portfolio value (holdings priced at current
market plus cash) is on the [control room](https://try-ballast.netlify.app/control-room).

Rows from Sep 10-11 include trades later reconciled by `correction` lines in the ledger:
the executor had a sizing bug that was fixed on Sep 11 and the books were corrected openly
(see the correction events in `ledger/events.jsonl`). Corrections are part of the record.
