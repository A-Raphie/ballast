import { readPolicyLive, readPolicyConfig, remotePolicyEnabled } from "@/agent/policy-config";
import { readLedger } from "@/lib/ledger";
import { Panel } from "@/app/components/kit";
import { PolicyBoard } from "./policy-board";

export const dynamic = "force-dynamic";

export default async function PolicyPage() {
  // live rulebook first: the repo is the source of truth the agent pulls from
  const [policy, view] = await Promise.all([
    (remotePolicyEnabled() ? await readPolicyLive() : null) ?? readPolicyConfig(),
    readLedger(),
  ]);

  const selfHosted = !process.env.NETLIFY;
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
        Your rules
      </h1>
      <p className="caption mt-2 max-w-2xl">
        You write the rules once. The agent re-reads this rulebook before every decision, and no
        prompt can weaken it: the gate is deterministic code. Every change is versioned and
        recorded in the ledger; the running agent cites the version it obeyed.
      </p>

      <Panel className="mt-8 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            The rulebook · policy v{policy.version}
          </h2>
        </div>
        <PolicyBoard
          selfHosted={selfHosted}
          targets={policy.targets}
          knobs={policy.knobs}
          coreClauses={policy.clauses.map((c) => ({ id: c.id, text: c.text, threshold: c.threshold, enabled: c.enabled !== false }))}
          library={policy.library ?? []}
          stats={view.clauseStats}
        />
      </Panel>

      <Panel className="mt-6 p-6">
        <h2 className="font-[family-name:var(--font-display)] mb-4 text-lg font-semibold">
          Glossary
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Sleeve", "one slice of the paper book: the rToken sleeve (tokenized stocks), the crypto shield (BTC/ETH hedge), or the USDT cash buffer."],
            ["Clause", "one line of the written policy. Every decision is checked against every enabled clause; the check result ships with the decision."],
            ["Clause chain", "the full receipt of one decision: what triggered it, each clause with the measured number, the verdict, the order."],
            ["Heel (24h)", "sailing term: how far the book lists below its UTC-day open value. A deep heel means the day hurt."],
            ["Night watch band", "the 24-hour canvas: shaded hours are when Wall Street is closed, dots are macro events, cyan diamonds are decisions."],
            ["rToken", "Bitget's tokenized US stocks (RNVDAUSDT = Nvidia as a token). They trade 24/7, which is the whole point."],
          ].map(([term, def]) => (
            <div key={term as string} className="card px-4 py-3">
              <div className="text-sm font-semibold">{term as string}</div>
              <p className="caption mt-1">{def as string}</p>
            </div>
          ))}
        </div>
      </Panel>
    </main>
  );
}