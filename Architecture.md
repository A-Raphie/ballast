# Ballast — Architecture

## Overview
A single TypeScript agent loop that runs unattended through the competition window: it senses macro events and dual-market prices (tokenized US stocks + crypto) from keyless Bitget surfaces, proposes rebalances via an LLM, gates every proposal through a deterministic written policy (emitting a clause chain), executes fills in Bitget's paper-trading demo environment, and appends everything to an in-repo ledger. A Next.js control room reads the ledger and renders the Night Watch Band.

## Components
- **sensor** — keyless data plane: Bitget public market endpoints (rToken + crypto tickers/candles) + `bitget-signal` MCP feeds (macro-analyst, news-briefing, sentiment-analyst). No account, no API key.
- **policy engine** — pure TS, zero LLM. The written policy as data: clause objects with id, text, measure, threshold, verdict. Every proposed action walks the clauses; the trace IS the clause chain. The engine cannot be talked into violating a clause.
- **decision core** — LLM (qwen3.8-max via Bitget's hackathon endpoint `hackathon.bitgetops.com/v1`, 30U credits; fallback: existing LLM keys) turns sensed events into proposed actions with plain-language reasons. Proposals are suggestions; the policy engine decides.
- **executor** — Bitget Agent Hub SDK (`bitget-agent-sdk`) in `--paper-trading` mode (demo env), dual-market orders. Requires the Demo API key (env var, HMAC signed locally).
- **ledger** — append-only JSONL in `ledger/`, committed to the repo by the runner. Event kinds: `market`, `macro`, `proposal`, `verdict`, `order`, `fill`, `shift` (rebalance). Decisions bundle trigger event ids, clause chain, order, counterfactual book.
- **runner** — GitHub Actions cron every 15 min; secrets: `BITGET_DEMO_KEY`, `BITGET_DEMO_SECRET`, `BITGET_DEMO_PASSPHRASE`, `LLM_API_KEY`. Each run appends and commits. Fallback: local launchd/caffeinate. Trade-off: 15-min granularity vs a persistent daemon; the demo env does not demand sub-minute latency, and the commit log doubles as public audit evidence.
- **control room (Next.js)** — Night Watch Band, exposure strip, heel gauge, clause-chain panel, policy page, raw-log page. Static reads of the ledger at build time + API route for the live strip.
- **landing** — remlo grammar; the band embedded as the framed live object.

## Data model
`ledger/events.jsonl` — one JSON object per line:
```
{ ts, seq, kind, ...payload }
market:  { symbol, market: rtoken|crypto, px, chg24h }
macro:   { source, headline, severity, assets_affected }
proposal:{ action, from, to, ratio, reason }
verdict: { proposal_id, clauses: [{id, text, measured, threshold, pass}], result: allow|deny }
order:   { decision_id, side, symbol, market, qty, type }
fill:    { order_id, px, ts }
shift:   { decision_id, moved: {from_book, to_book}, exposure_after }
```
`policy/policy.json` — the written policy as data (versioned); `policy/POLICY.md` — the human-readable same document.

## Tech stack
| Layer | Choice | Why |
|---|---|---|
| Agent/runner | TypeScript on Node 20 | one language across agent + UI; SDK is TS |
| LLM | qwen3.8-max (Bitget hackathon endpoint) | free credits; sponsor token usage is a scored form field |
| Frontend | Next.js (App Router) + Vercel | proven hosting path |
| Ledger | JSONL in-repo | auditable by judges, diffable, no DB to host |
| Runner | GitHub Actions cron | free always-on; commit log = public audit trail |
| Charts/band | hand-rolled SVG on the canvas | the band is bespoke (signature), no chart lib candles |

## Key decisions & trade-offs
- **Cron loop, not persistent daemon** — free, auditable, zero hosting burn (Railway's single slot is occupied). Trade-off: 15-min reaction granularity and cold starts; acceptable for overnight-scale events.
- **Deterministic gate around an LLM brain** — LLM proposes, policy disposes. Trade-off: fewer "clever" trades; buys the exact thing judges score (risk-control effectiveness + explainability) and matches his invariant-guard instincts.
- **Ledger in-repo** — judges can `git log` the paper log. Trade-off: repo noise (one commit per run window, batched).
- **Qwen as decision LLM** — free credits + form asks where Qwen was used. Fallback path kept behind an env flag.

## API surface
- `GET /api/live` — latest market row + exposure + heel for the strip (reads ledger tail + fresh public tickers).
- Everything else is build-time static from the ledger.

## Open architectural questions
- [assumption: rToken symbol list + public endpoints confirmed in Phase 0 spike; S1 precedent says yes.]
- [assumption: GitHub Actions secrets accept the demo key trio; verify when the key arrives.]
