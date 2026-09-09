# Ballast — Tasks

Legend: `[ ]` not started · `[~]` in progress · `[x]` done
Deadline arithmetic: submission closes Sep 21 (UTC+8). Paper-log days are the score; every phase defers to log continuity.

## Phase 0 — Foundations (Sep 9, today)
- [x] Repo + spec scaffold + design brief — done when docs exist and are pushed
- [ ] Keyless data probe: public endpoints return rToken + crypto tickers/candles — done when a script prints a dual-market price row with no key
- [ ] Study `bitget-agent-sdk` paper-trading path (local SDK clone); map exact call surface for orders/fills
- [ ] Ledger schema + `policy/POLICY.md` v0 draft (5-8 clauses: max book drift, drawdown guard, hedge ratio band, event-severity minimum, blackout, single-asset concentration cap)
- [ ] Next.js scaffold + semantic tokens from `docs/design.md` (zero raw hex)

## Phase 1 — Spike to running loop (Sep 10-12)
- [ ] Executor spike with his Demo API key: one paper order + fill recorded in ledger (DEPENDS on his key)
- [ ] Decision core wired: qwen3.8-max proposal on a sensed event, policy gate verdict, ledger write
- [ ] Runner live: GitHub Actions cron appends + commits; 24h unattended survival
- [ ] Control room v0: Night Watch Band renders the real ledger (windows, markers, fixes)
- [ ] Paper-log clock audit: confirm fills timestamp from first executor day (log-days accrue from Sep 10-11)

## Phase 2 — Continuous run + full surface (Sep 13-16)
- [ ] Real macro event captured with a plotted fix (else invoke kill-criteria replay path)
- [ ] Clause-chain panel, policy page, raw-log page built
- [ ] Heel gauge + exposure strip live
- [ ] Hardening: 48h unattended, error paths ledger visible (a runner failure is itself logged, not hidden)
- [ ] Go/no-go on kill criteria (Sep 16 checkpoint)

## Phase 3 — Landing + polish + demo (Sep 17-19)
- [ ] Landing (remlo grammar, band as framed object, front door + enter path)
- [ ] claims-verify pass on all copy vs deployed build
- [ ] ship-rehearsal → pre-ship-gate on the deployed URL
- [ ] Demo video: demo-script storyboard (scenes mapped to judging criteria) → vo-first (his VO) → desktop-demo take
- [ ] X post drafted (x-post skill; #BitgetHackathon + @Bitget_AI)

## Phase 4 — Submission (Sep 20-21)
- [ ] Google Form answers (6-part description, LLM role incl. Qwen usage, materials link, X link, sub-theme = Cross-Asset Execution Agent, Demo Day = Yes, K3 = Yes)
- [ ] README = judge front door; judge path < 2 min; staged per winsznx package pattern
- [ ] Notify-gate dump → HIS submit click before Sep 21 deadline (UTC+8)

## Dependencies
- Executor spike blocks Phase 1 completion and the log clock.
- UI family (Phase 2) can build against replayed ledger fixtures before the key lands.
- Video needs his VO audio; do not shoot before it exists (os-demo-take-method rule).

## Done = submitted
Google Form complete + compliant X post live + repo public + control room deployed + video attached + his confirmed submit before deadline.
