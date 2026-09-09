# Ballast — PRD

## Problem
Tokenized US stocks (rToken) trade 7×24, but their holders still think in market hours. Macro shocks land at 2am on Sunday while the native market cannot react; the rToken book eats the move alone. Meanwhile every "trading agent" at this event will claim it manages risk, and almost none will be able to show its work. Bitget scores half the track on exactly that: decision explainability, architecture quality, risk-control effectiveness.

## Personas
- **Primary: the track judges** — scoring dozens of agent entries on paper metrics + explainability; they need to verify discipline in minutes, not trust a demo video.
- **Secondary: the 24/7 tokenized-stock holder** — keeps an rToken book over weekends/overnights; needs the book defended while they sleep, with a readable account of every move.

## Jobs to be Done
1. When a macro event breaks while the US market is closed, I want the agent to rebalance the rToken book into crypto per a written policy, so my book is defended without me waking up.
2. When I evaluate the agent, I want every decision's full clause chain (trigger, policy clauses checked, gate verdicts, order, counterfactual), so I can verify discipline instead of trusting claims.
3. When I audit the run, I want an append-only log with real timestamps over the whole competition window, so the paper metrics are reproducible.

## Scope (v1)
- Agent loop: sense (keyless market data + signal feeds) → decide (LLM proposes) → gate (deterministic policy engine, clause-by-clause verdicts) → execute (Bitget paper-trading demo env) → record (append-only ledger).
- Written risk policy as a first-class artifact (versioned, human-readable, the gate's source of truth).
- Control room: Night Watch Band (24h canvas: closed windows, macro markers, plotted fixes), exposure strip, heel gauge, clause-chain panel.
- Landing page with the live band as the framed product object.
- Continuous paper log over the competition window, committed in-repo.

## Non-goals
- Real funds. Paper/demo environment only; no live trading, no withdrawals.
- Alpha claims. The quant story is measured discipline (drawdown, zero violations), not Sharpe-chasing.
- Multi-broker support, backtesting engine, mobile app, user accounts/auth.
- S1-style "safety belt that blocks orders" (NightDesk owns that narrative); Ballast is an autonomous executor that proves itself.

## Success metrics
- Paper log continuous from first key day through Sep 21 (≥12 days by deadline).
- ≥1 real after-hours macro event captured with a plotted hedge fix (else: honestly-labeled scripted gauntlet replay, decided Sep 16).
- Zero policy violations across the whole run (the selling point).
- Complete submission: Google Form (6-part description, LLM role, materials link, compliant X post), demo video, live control room.

## Kill criteria
- Demo API key not working by Sep 13 → executor pivots to simulated fills with honest labeling (track allows "simulated or paper trading").
- No real macro event in-window by Sep 16 → demo leans on the scripted gauntlet replay, labeled as such everywhere.
- Agent loop cannot run unattended for 48h by Sep 14 → cut UI scope to band + clause chain only and stabilize the loop.

## Open questions
- [assumption: US-stock (rToken) market data is readable via Bitget public endpoints without a key; S1 winner Nocturne tracked seven tokenized stocks on public market data. Verify in Phase 0 spike.]
- [assumption: GitHub Actions cron (15 min) + secrets-held demo key is a valid always-on runner; fallback is a local caffeinate process. Decision recorded in Architecture.md.]
- [assumption: his Bitget account + Demo API key arrives by Sep 11; clock starts that day.]
