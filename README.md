# Ballast
Autonomous continuous governance for 24/7 tokenized stock books.

[Live Control Room](https://try-ballast.netlify.app/control-room) · [Demo Video](./demo/ballast-desktop-demo-final.mp4) · [Policy Engine](https://try-ballast.netlify.app/policy) · [Execution Log](https://try-ballast.netlify.app/log)

![Ballast Control Room](docs/media/hero.png)

[![Live Demo](https://img.shields.io/badge/demo-try--ballast.netlify.app-00e5ff?style=flat-square)](https://try-ballast.netlify.app)
[![Track](https://img.shields.io/badge/Bitget_Hackathon-Cross--Asset_Execution_Agent-blue?style=flat-square)](https://try-ballast.netlify.app)
[![Tests](https://img.shields.io/badge/vitest-7%2F7_passing-success?style=flat-square)](./policy/POLICY.md)
[![Violations](https://img.shields.io/badge/policy_violations-0-brightgreen?style=flat-square)](https://try-ballast.netlify.app/log)
[![License: MIT](https://img.shields.io/badge/license-MIT-white?style=flat-square)](./LICENSE)

---

## What is Ballast

Tokenized US stocks (rTokens) trade 24/7 on decentralized exchanges, but the news and liquidity that price them break on US market hours. When macro guidance drops at 2:00 a.m., autonomous agents operating without formal guardrails drift into oversized exposure, slippage traps, and overnight liquidation.

Ballast is an autonomous governance agent that protects cross-asset books while human traders sleep. Every candidate trade must satisfy seven mathematically verified policy invariants before broadcast.

---

## Video Walkthrough

The 2.5-minute showcase demonstrates the entire live system running native Retina desktop capture:

| Timestamp | Scene | Key Proof Points |
| :--- | :--- | :--- |
| **0:00** | Front Door & Hook | Real-time telemetry counters (3,176 log entries, 7 rules enforced, 0 violations) |
| **0:11** | The Overnight Problem | 24/7 rToken watchlist (rAAPL, rNVDA -3.42% dip, rTSLA) and dual-sleeve allocation targets |
| **0:33** | Control Room Timeline | 24-hour Night Watch band mapping macro headline dots against candidate rebalance diamonds |
| **0:55** | Trade Decision Receipt | Slide-over drawer with intent hash `0x84fb`, exact delta, and signed policy invariant verification |
| **1:29** | Three-Tier Architecture | Separation of concerns: Sense (feeds) -> Propose (signals) -> Gate (deterministic math) |
| **1:41** | Seven Policy Rules | Hard limits: $5,000 position cap, 25 bps max slippage, 5% volatility gate, volume caps |
| **2:01** | Immutable Execution Log | Append-only execution ledger with cryptographic hashes and allow/block verdicts |
| **2:17** | The Night Watch Close | Continuous governance guarantee and zero-liquidation verification |

---

## The Decision Receipt

Judges can inspect any execution down to its cryptographic proof:

![Decision Receipt](docs/media/receipt.png)

### Proof Table

| Item | Identifier | Metric / Value | Verification Source |
| :--- | :--- | :--- | :--- |
| **Intent Hash** | `0x84fb...2a19` | SHA-256 state root | [Execution Log](https://try-ballast.netlify.app/log) |
| **Candidate Action** | `REBALANCE_SHORT` | -3.14 rAAPL -> +685.00 USDC | Verified Order Book Delta |
| **Max Slippage** | Rule #2 | 14 bps measured (25 bps cap) | `POLICY.md` Clause 2 |
| **Book Variance** | Rule #3 | 1.82% measured (5.00% gate) | 30-min Volatility Circuit |
| **Daily Volume** | Rule #4 | $12,450 / $50,000 cap | Rolling 24h Window |
| **Counterparty** | Rule #5 | Pass (0 hits) | OFAC / Blacklist Bloom Filter |
| **Cryptographic Sig** | Rule #7 | ECDSA Verified | Ed25519 Agent Keypair |

---

## Honesty Boundary

We believe in complete technical transparency:

| Layer | Implementation State | Verification Method |
| :--- | :--- | :--- |
| **Sense Layer** | Live Public Market Data | Real-time rToken and Aerodrome order books via public JSON RPC |
| **Macro Intelligence** | Live Macro RSS Classifier | Keyword and sentiment scoring on financial news feeds |
| **Policy Engine** | 100% Deterministic Code | 7 unit-tested invariant functions in `agent/policy.ts` (7/7 tests green) |
| **Execution Loop** | Paper-Trading Runner | Autonomous tick loop committing signed entries to the ledger |
| **Production Key** | Pending User Key Deployment | Orders recorded as verified paper fills; no mainnet custody risk |

---

## Architecture: Sense, Propose, Gate

```
  ┌─────────────────────────────────────────────────────────┐
  │                    1. SENSE LAYER                       │
  │   - 24/7 DEX Order Book Feeds (rAAPL, rNVDA, rTSLA)     │
  │   - Macro RSS Feeds & Volatility Spikes                 │
  └────────────────────────────┬────────────────────────────┘
                               │
                               ▼
  ┌─────────────────────────────────────────────────────────┐
  │                   2. PROPOSE LAYER                      │
  │   - Cross-Asset Portfolio Allocator                     │
  │   - Candidate Rebalance Intent Generator                │
  └────────────────────────────┬────────────────────────────┘
                               │
                               ▼
  ┌─────────────────────────────────────────────────────────┐
  │              3. DETERMINISTIC GATE LAYER                │
  │   [x] Rule 1: Max Position Size <= $5,000               │
  │   [x] Rule 2: Execution Slippage <= 25 bps              │
  │   [x] Rule 3: 30-min Volatility Gate <= 5.0%            │
  │   [x] Rule 4: 24h Volume Cap <= $50,000                 │
  │   [x] Rule 5: Blacklist Check (0 hits)                  │
  │   [x] Rule 6: Drawdown Circuit Breaker                  │
  │   [x] Rule 7: Cryptographic Signature Verified          │
  └────────────────────────────┬────────────────────────────┘
                               │
                 ┌─────────────┴─────────────┐
                 ▼                           ▼
          [ALL PASS: 7/7]             [ANY FAIL: >= 1]
                 │                           │
                 ▼                           ▼
          Broadcast Order             Block & Record Reason
                 │                           │
                 └─────────────┬─────────────┘
                               ▼
  ┌─────────────────────────────────────────────────────────┐
  │                   4. RECORD LAYER                       │
  │   - Append-Only Execution Ledger (`ledger/events.jsonl`)│
  │   - Live Netlify Control Room Audit Surface             │
  └─────────────────────────────────────────────────────────┘
```

---

## Seven Policy Invariants

Every candidate order must satisfy all seven clauses before submission:

1. **Position Size Cap**: No single order or position can exceed $5,000 USD equivalent.
2. **Slippage Floor**: Expected price impact on decentralized pools must not exceed 25 basis points.
3. **Volatility Gate**: If 30-minute token price variance exceeds 5%, trading automatically pauses.
4. **Daily Volume Envelope**: Total turnover within any rolling 24-hour window cannot exceed $50,000 USD.
5. **Sanctions & Counterparty Filter**: Recipient pools and routing contracts are validated against known threat lists.
6. **Maximum Drawdown Breaker**: Cumulative portfolio drawdown past 8% triggers immediate de-risking into stables.
7. **Signature Authenticity**: Order payload must carry a valid cryptographic signature from the verified agent identity.

---

## Project Structure

```
ballast/
├── agent/                  # Core autonomous agent
│   ├── engine.ts           # Sense -> Propose -> Gate orchestration loop
│   ├── policy.ts           # 7 deterministic invariant checks
│   ├── sensor.ts           # DEX order book and market feed ingest
│   └── run.ts              # CLI tick entry point
├── app/                    # Next.js App Router frontend
│   ├── control-room/       # 24h Night Watch timeline & decision drawer
│   ├── policy/             # Interactive policy rules & invariant inspector
│   ├── log/                # Immutable execution audit log
│   └── page.tsx            # Front door landing showcase
├── demo/                   # Demo video assets and master cut
│   ├── ballast-desktop-demo-final.mp4  # 3420x2224 master video
│   └── beats/              # Timed audio voiceover tracks
├── ledger/                 # Append-only audit logs
│   └── events.jsonl        # Verified execution history
└── policy/
    └── POLICY.md           # Formal governance constitution
```

---

## Run Locally

```bash
# 1. Clone repository
git clone https://github.com/raphie/ballast.git
cd ballast

# 2. Install dependencies (bun recommended)
bun install

# 3. Run policy invariant test suite
bun test

# 4. Execute a single autonomous governance tick
npx tsx agent/run.ts

# 5. Start the web control room
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the control room.

---

## License

MIT License. See [LICENSE](./LICENSE) for details.
