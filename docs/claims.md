# Claims evidence table (living)

Per the claims-verify write-time contract: every promise sentence on a public
surface carries its backing. Update this table with every copy edit.

Sep 13 plain-language sweep: all surfaces rewritten via lib/display.ts (normie
verbs, symbols mapped to "tokenized Nvidia" style names, B-codes demoted to
tooltips + link anchors). Rows below quote the CURRENT live copy.

| Claim | Surface | Backing | Status |
|---|---|---|---|
| "Tokenized US stocks trade 24/7" | landing | venue design; sensor pulls rToken prices at all hours | TRUE |
| "moves your tokenized stocks into crypto when a shock lands overnight" | landing | ledger decisions with allow verdicts on macro events | TRUE (simulated, disclosed) |
| "hands you a receipt showing exactly why every trade was allowed" | landing | every order pairs 1:1 with a verdict (15/15, 1/1 post-reset); ClauseRow renders text + measured number + rule code | TRUE |
| "Practice money. Real prices. Every practice trade labeled as such." | landing | executionMode()=simulate; every order/fill carries execution:"simulated"; order chips say "practice"/"simulated" | TRUE |
| "Watching since / Log entries N / Rules enforced 7 / Rule violations 0" | landing proof strip | computed from ledger + archive first tick + policy.json (7 clauses) | TRUE |
| "You set the rules once. Ballast re-reads this page before every trade" | policy | Save commits policy.json to the repo via Contents API (verified end-to-end: v1.1.1 -> v1.1.2 round trip); runner pulls per tick; verdicts cite the obeyed version | TRUE |
| "no AI at the gate, just fixed code that checks each rule" | policy | policy.ts pure measures; 9/9 gate tests | TRUE |
| "Every change is saved as a new version, and every receipt cites the version it obeyed" | policy | policy_change events in the ledger on each version change (site commit -> agent pull -> event) | TRUE |
| "checked every 15 minutes, no API keys needed" | landing | sensor uses public endpoints; cron 15 min | TRUE |
| "Fixed rules, not an AI, decide every trade today. An AI decision slot is wired" | landing toolkit | propose.ts threshold fallback; LLM path behind LLM_PROVIDER | TRUE |
| "authorized through Agent Hub" | landing toolkit | ~/.bitget/oauth_token.json; UID 8283456997 account_overview ok | TRUE |
| "built by Raphie" | footer | links to https://x.com/a_raphie | TRUE |
