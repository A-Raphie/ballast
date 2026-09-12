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
          version={policy.version}
          targets={policy.targets}
          knobs={policy.knobs}
          coreClauses={policy.clauses.map((c) => ({ id: c.id, text: c.text, threshold: c.threshold, enabled: c.enabled !== false }))}
          library={policy.library ?? []}
          stats={view.clauseStats}
        />
      </Panel>
    </main>
  );
}
