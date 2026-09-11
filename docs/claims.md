# Claims evidence table (living)

Per the claims-verify write-time contract: every promise sentence on a public
surface carries its backing. Update this table with every copy edit.

| Claim | Surface | Backing | Status |
|---|---|---|---|
| "Tokenized US stocks trade 24/7" | landing | venue design; sensor pulls rToken prices at all hours | TRUE |
| "shifts your tokenized-stock book into crypto when a shock lands overnight" | landing | ledger decisions with allow verdicts on macro events | TRUE (simulated, disclosed) |
| "hands you the clause chain that allowed every single move" | landing | every order pairs 1:1 with a verdict (15/15, 1/1 post-reset) | TRUE |
| "Paper book. Real prices. Simulated fills, labeled on every line." | landing | executionMode()=simulate; every order/fill carries execution:"simulated" | TRUE |
| "Sensing since Sep 9 (archive-backed) / Ledger lines N (current ledger) / Clauses enforced 7 / Risk violations 0" | landing proof strip | computed from ledger + archive first tick + policy.json (7 clauses) | TRUE |
| "You write the rules once. The agent re-reads this rulebook before every decision" | policy | engine loads policy.json per evaluate; loadBook syncs targets per tick | TRUE (public deploy read-only, stated on page) |
| "no prompt can weaken it: the gate is deterministic code" | policy | policy.ts pure measures; 9/9 gate tests | TRUE |
| "Every change is versioned and recorded in the ledger" | policy | /api/policy bumps version + appends policy_change event | TRUE (self-hosted writes; public deploy read-only, stated) |
| "keyless, every 15 minutes" | landing + toolkit card | sensor uses public endpoints; cron 15 min | TRUE |
| "The decision core is a deterministic rules engine today. The Qwen slot is wired" | landing toolkit | propose.ts threshold fallback; LLM path behind LLM_PROVIDER | TRUE |
| "authorized through Agent Hub's Agentic-account OAuth" | landing toolkit | ~/.bitget/oauth_token.json; UID 8283456997 account_overview ok | TRUE |
| "built by Raphie" | footer | links to https://x.com/a_raphie | TRUE |
