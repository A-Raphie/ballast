# AGENTS.md — Ballast

Behavior layer for agents working in this repo. Read Handoff.md first for current state.

## What this is
Ballast: an autonomous cross-asset hedge agent for tokenized US stocks (rToken), built for Bitget AI Base Camp Hackathon S2 (Agentic Trading track). It senses macro events on a 7×24 market, proposes rebalances via LLM, gates them through a deterministic written policy, executes on Bitget's paper-trading demo env, and appends everything to an in-repo ledger. The Next.js control room renders the Night Watch Band from that ledger.

## Hard rules
1. **Paper only.** Nothing in this repo may place a real-money order. Executor runs exclusively against the demo environment. Any code path that could touch main-account funds fails review.
2. **The ledger is append-only.** Never rewrite committed lines. Corrections are new `correction` events.
3. **The policy engine owns the gate.** LLM output is a proposal; it never executes without clause verdicts. Never weaken a clause to make a trade pass.
4. **Zero raw hex in components.** All colors via semantic tokens in `app/globals.css`. Tokens come from `docs/design.md` (mined from Bitget live CSS, not guessed).
5. **No em dashes** in any shipped copy, UI string, README, or doc. Use ":" or "·".
6. **Real data or labeled fixtures.** The UI renders the ledger; fixture data for development must be namespaced (`fixtures/`) and never shipped as if live. Any simulated element in the demo is labeled as simulated.
7. **Honesty as credibility.** Metrics that are noise get labeled noise. The writeup claims discipline, not alpha.

## Stack
- Node 20, TypeScript everywhere.
- LLM: qwen3.8-max via `https://hackathon.bitgetops.com/v1` (env `LLM_API_KEY`); fallback provider behind `LLM_PROVIDER` flag.
- Executor: `bitget-agent-sdk`, paper mode; credentials in env only (`BITGET_DEMO_KEY/SECRET/PASSPHRASE`), HMAC signed locally.
- Runner: GitHub Actions cron (15 min) committing ledger updates; local fallback via launchd.
- Frontend: Next.js App Router on Vercel; static ledger reads + one `/api/live` route.

## Layout
```
agent/        sensor, policy engine, decision core, executor (TS)
policy/       POLICY.md (human) + policy.json (machine), same content
ledger/       events.jsonl (append-only) + decisions/
app/          Next.js control room + landing
fixtures/     development-only replay data
docs/         design.md + research notes
```

## Working agreements
- Every meaningful change: update Handoff.md, tick Tasks.md, commit, push. The repo is the model-switch insurance.
- New screens follow `docs/design.md` (user flow list = build order; folds appended to "Folds used").
- Before any claim ships in copy: verify it against the running build (claims-verify rule).
- Judging criteria are the spec: paper metrics (Sharpe/DD/win-rate), decision explainability, architecture quality, risk-control effectiveness. Every feature must serve one of the four.
