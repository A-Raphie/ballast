# Ballast — Memory

## Decisions
- **2026-09-09** — Idea = Ballast (cross-asset overnight hedge agent), Agentic Trading track, Cross-Asset Execution sub-theme: sponsor-primitive-fit × podium-density per forensic playbook; autopsy SURVIVED. (Alternatives: Gauntlet eval-benchmark Open Theme, Factor Miner — both rejected: tooling-read risk / 12-day quant risk.)
- **2026-09-09** — Design: 24h Night Watch Band time-canvas + decision-ink cyan scarcity; document/ledger + receipts-as-paper banned by DESIGN_LEDGER diff (rushes/assay/scrip/reeve own them).
- **2026-09-09** — Runner = GitHub Actions cron, not persistent daemon: free, auditable; Railway slot occupied by purser.
- **2026-09-09** — LLM = qwen3.8-max via Bitget hackathon endpoint: free 30U credits; form scores Qwen usage. Fallback behind env flag.
- **2026-09-09** — Gate architecture: LLM proposes, deterministic policy engine disposes; clause chain is the gate trace. Trade-off accepted: fewer clever trades, buys the scored criteria.
- **2026-09-09** — Ledger = JSONL in-repo: judges can git-log the paper log; no hosted DB.

## Conventions
- No em dashes anywhere in shipped copy/UI/README (hard rule).
- Numbers in UI: tabular numerals; every verdict carries glyph + text, never color alone.
- Ledger lines are immutable once committed; corrections are new `correction` events, never edits.
- Voiceover TTS Voice: ALWAYS use `minimax_273587280617670` for all demo voiceovers and audio takes (hard rule).

## Gotchas
- Bitget public tickers v2: multi-symbol query REJECTED (`40034 does not exist` for comma or slash separators, verified Sep 9). Sensor pattern: one keyless `GET /api/v2/spot/market/tickers` (no param) returns ALL symbols, filter in code. Live-verified: RNVDAUSDT/RTSLAUSDT/RAAPLUSDT/RSPYUSDT + BTC/ETH all present, ~1s freshness.
- rToken symbols on spot: `R<UNDERLYING>USDT` (RNVDA, RTSLA, RAAPL, RMSFT, RGOOGL, RMETA, RAMZN, RSPY, RQQQ, RCRCL, RHOOD) plus leveraged/inverse variants (RQQQI, RIQQQ, RSQQQ, RTQQQ).
- Bitget form: no compliant X post (#BitgetHackathon + @Bitget_AI) = invalid submission, regardless of build quality.
- 2-theme max per team; Ballast is the single entry (solo, 12 days).
- Pulse (Bitget display face) is proprietary: Archivo substitute, never hotlink.
- Demo env = separate credentials from main Bitget API keys; do not mix.

## Things to not forget
- His Bitget account + Demo API key = the log-clock blocker (asked Sep 9).
- Qwen credits form + KYC are HIS moves if wanted (first 300 teams).
- Public voting window 9/22-10/7 needs the project ID rallied on X (fan-favorite stacks).
- Sep 16 kill-criteria checkpoint; Sep 13 executor-pivot checkpoint.
- **Demo Video Production Rules (Hard Invariants)**:
  1. **Strict Real-App Visual Continuity**: Every scene must use real live deployed application surfaces (`try-ballast.netlify.app`), scaling edge-to-edge across the target canvas (3420x2224 Retina) without unscaled partial crops or black voids.
  2. **No Nested Media Artifacts**: Never mix prototype player frames, nested window chrome, playback controls (play buttons, scrubber bars, timecodes), subtitle overlays, or ghost/static cursors from earlier draft presentations into real desktop video cuts.
  3. **Cross-Scene Visual Gate**: Before muxing, audit every scene against the deployed app. If Scene N-1 and Scene N+1 are on the real browser, Scene N must maintain the exact same authentic desktop chrome and site navbar.
  4. **Self-Inspection Gate Before Delivery**: The agent must always extract and visually inspect milestone frames across all scenes from the final muxed video itself before presenting to the user, ensuring zero visual defects, black voids, or alien elements.
  5. **Multi-Subagent Visual QA Swarm**: Before presenting any video to the user, run a parallel swarm of specialized subagents (Visual Continuity Auditor, Alien Artifact Hunter, Audio & Pacing Gate, Cursor Dynamics Auditor). No video may be delivered to the user without unconditional PASS verdicts from all subagents.
  6. **Voice Selection (Hard Invariant)**: Always use `minimax_273587280617670` for demo narrations and audio samples.
  7. **Recording Environment (Hard Invariant)**: ALWAYS record on Desktop 2 and make sure Chrome is on fullscreen (`--start-fullscreen`). Never record on Desktop 1.
