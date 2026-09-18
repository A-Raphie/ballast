# Ballast Written Risk Policy · v1.2.27

The policy is the gate's source of truth. The machine-readable twin lives in `policy.json`; this document is the human-readable same content. The agent cannot trade a proposal the policy does not allow, and no prompt can weaken a clause: the engine is deterministic code.

Values below are the live values at v1.2.27. Every threshold is editable on the live rules page (try-ballast.netlify.app/policy); each edit commits a new version of both twins to this repo.

## Targets
- Tokenized stocks: **65%** of the portfolio
- Crypto shield: **25%** of the portfolio
- Cash (USDT): **10%**

## Clauses

| id | Clause | Threshold | On unmeasurable |
|---|---|---|---|
| B1-drift | Only trade when a holding group has wandered far enough from its target share | drift > 10 points | halt |
| B2-drawdown | If the portfolio is already down on its day, make no trade that adds risk | drawdown <= 2.5% or action risk-reducing | halt |
| B3-hedge-band | The crypto shield must stay inside its written floor and ceiling | 21%-30% of the portfolio | deny |
| B4-event | A trade needs a big-enough news story within the lookback window | severity >= medium within 12h | halt |
| B5-blackout | Stay quiet in the minutes just before and after the US market opens or closes | outside 14:00-15:00 / 20:30-21:30 UTC | n/a (always measurable) |
| B6-concentration | No single holding may end up past its size cap after the trade | max <= 28% | halt |
| B7-stale | If market prices are too old to trust, stop everything | freshest market row <= 600s old | deny |

## Semantics
- `allow`: every clause measured and passed. The executor may act (simulated, labeled fill).
- `deny`: at least one clause measured and failed. The proposal is dead; the reason ships with the receipt.
- `halt`: at least one clause could not be measured (missing data, no macro window). The agent stands down rather than guess. Halts are the honest majority case in quiet markets, and that is the point.

## Amendment rule
Clause text and thresholds change only by version bump of `policy.json` (this document follows), with the change recorded in the ledger as a `policy_change` event. Every verdict cites the version it obeyed.
