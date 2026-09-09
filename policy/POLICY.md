# Ballast Written Risk Policy · v1.0.0

The policy is the gate's source of truth. The machine-readable twin lives in `policy.json`; this document is the human-readable same content. The agent cannot trade a proposal the policy does not allow, and no prompt can weaken a clause: the engine is deterministic code.

## Targets
- rToken sleeve target: **65%** of book value
- Crypto hedge sleeve target: **25%** of book value
- USDT buffer: **10%**

## Clauses

| id | Clause | Threshold | On unmeasurable |
|---|---|---|---|
| B1-drift | Rebalance only when a sleeve drifts from target | drift > 10pp | halt |
| B2-drawdown | No risk-increasing action while the book is down on its UTC-day open | drawdown <= 2.5% or action risk-reducing | halt |
| B3-hedge-band | Crypto hedge sleeve stays inside a band | 20%-50% of book | deny |
| B4-event | A shift needs a qualifying macro trigger | severity >= medium within 12h | halt |
| B5-blackout | No action near US equity open/close | outside 14:00-15:00 / 20:30-21:30 UTC | n/a (always measurable) |
| B6-concentration | No single position dominates the book | max <= 35% | halt |
| B7-stale | Halt everything on stale data | freshest market row <= 600s old | deny |

## Semantics
- `allow`: every clause measured and passed. The executor may act.
- `deny`: at least one clause measured and failed. The proposal is dead; the trace ships with the receipt.
- `halt`: at least one clause could not be measured (missing data, no macro window). The agent stands down rather than guess. Halts are the honest majority case in quiet markets, and that is the point.

## Amendment rule
Clause text and thresholds change only by version bump of this file + `policy.json` in the same commit, with the change recorded in Memory.md. The ledger records `POLICY_VERSION` with every verdict.
