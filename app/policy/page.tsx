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
        You set the rules once. Before every trade, Ballast re-reads this page and obeys it
        exactly: no AI at the gate, just fixed code that checks each rule. Every change is saved
        as a new version, and every receipt cites the version it obeyed.
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
          A few words the receipts use
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Tokenized stocks (rToken)", "US stocks like Nvidia or Tesla issued as tokens on Bitget. Same companies, but they trade 24/7, which is the whole point."],
            ["The crypto shield", "a slice of bitcoin and ethereum held on purpose: when stocks wobble overnight, the shield softens the hit."],
            ["Cash (USDT)", "plain dollars on-chain, parked and ready."],
            ["Rule codes (B1, B2, ...)", "short IDs for the seven rules. They appear in receipts so any decision can be traced to the exact written rule."],
            ["Receipt", "the full record of one decision: what news triggered it, each rule with its measured number, the verdict, and the order."],
            ["Night watch band", "the 24-hour strip on the control room: shaded hours are when Wall Street is closed, dots are news stories, cyan diamonds are decisions."],
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