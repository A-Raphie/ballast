# Ballast — Handoff

Read this first if you're picking up the project.

## Current state
Day 6, Sep 9 evening: the agent is ALIVE. Full tick loop (sense markets + macro RSS -> propose -> 7-clause policy gate -> order) runs every 15 min on his Mac via caffeinate runner (pid see /tmp/ballast-tick.log); ledger events.jsonl is accruing real keyless data and is committed to the repo per tick. Control room + landing + policy + log surfaces render the real ledger (verified in browser). Orders record as pending-key until his Bitget Demo key lands; fills + the formal paper-log clock start that day. Install tool: bun (npm crashes with Arborist edgesOut bug on this machine).

## What's done
- Everything above, plus: agent core (agent/: sensor, macro RSS + keyword classifier, policy engine, threshold-fallback proposer, ledger), 7/7 vitest gate tests, first live ticks with a full allow chain (proposal -> 7 PASS verdicts -> pending-key order).
- UI: kit.tsx (harvested beautifului grammar on tokens), watch-floor.tsx (Night Watch Band + clause chain panel), landing /, /control-room, /policy, /log, /api/live. Zero-raw-hex gate clean; next build green; all routes smoke-tested 200 and visually verified.
- Runner: local caffeinate loop every 15 min committing ledger; GH Actions tick.yml staged (schedule disabled: two writers would conflict).

## In progress
- Keyless data probe (public rToken + crypto endpoints) — Phase 0.

## Blocked / waiting
- Executor spike (real paper fills) + LLM proposer (Qwen key) — blocked on his Bitget account + Demo Trading API key (asked Sep 9). Everything else runs.

## How to run it
```bash
bun install          # npm is broken on this machine (Arborist edgesOut bug)
npx vitest run       # 7 policy gate tests
npx tsx agent/run.ts # one manual tick (keyless; appends to ledger/)
npx next build && npx next start -p 3311
```

## Next steps
1. Phase 0: keyless data probe + SDK study + policy draft + Next.js tokens (all no-key).
2. The moment the demo key lands: executor spike, one paper order + fill in the ledger, clock starts.
3. Control room v0 against replayed ledger fixtures (can proceed pre-key).

## Open questions
- rToken public symbol list (verify in probe).
- GitHub Actions secrets for the demo key trio (verify at key arrival).

## Pointers
- Spec: [PRD.md](./PRD.md) · [Architecture.md](./Architecture.md) · [Tasks.md](./Tasks.md)
- UI: [docs/design.md](./docs/design.md)
- History: [Memory.md](./Memory.md)
