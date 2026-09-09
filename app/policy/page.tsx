import { promises as fs } from "node:fs";
import path from "node:path";
import { readLedger } from "@/lib/ledger";
import { Panel } from "@/app/components/kit";

export const dynamic = "force-dynamic";

interface PolicyJson {
  version: string;
  targets: { rtokenPct: number; hedgePct: number; usdtPct: number };
  clauses: { id: string; text: string; threshold: string; onUnmeasurable: string }[];
}

export default async function PolicyPage() {
  const [policy, view] = await Promise.all([
    fs.readFile(path.join(process.cwd(), "policy", "policy.json"), "utf8").then(JSON.parse) as Promise<PolicyJson>,
    readLedger(),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
        The written policy
      </h1>
      <p className="caption mt-2 max-w-2xl">
        The policy is the gate's source of truth. The agent cannot trade a proposal this policy
        does not allow, and no prompt can weaken a clause: the engine is deterministic code, and
        every verdict records its clause-by-clause trace.
      </p>

      <Panel className="mt-8 p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">
            Targets · policy v{policy.version}
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["rToken sleeve", policy.targets.rtokenPct],
            ["Crypto hedge", policy.targets.hedgePct],
            ["USDT buffer", policy.targets.usdtPct],
          ].map(([label, v]) => (
            <div key={label as string} className="card px-4 py-3">
              <div className="micro">{label as string}</div>
              <div className="num number-lg mt-1 text-2xl">{((v as number) * 100).toFixed(0)}%</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="mt-6 p-6">
        <h2 className="font-[family-name:var(--font-display)] mb-4 text-lg font-semibold">
          Clauses and their lifetime record
        </h2>
        <div className="space-y-4">
          {policy.clauses.map((c) => {
            const s = view.clauseStats[c.id] ?? { pass: 0, fail: 0, halt: 0 };
            return (
              <div key={c.id} className="border-b border-[var(--border-default)] pb-4 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="mono text-[var(--text-secondary)]">{c.id}</span>
                    <span className="ml-3 text-sm">{c.text}</span>
                  </div>
                  <span className="num caption">
                    ✓ {s.pass} · ✗ {s.fail} · ‖ {s.halt}
                  </span>
                </div>
                <div className="caption mt-1">
                  threshold: {c.threshold} · unmeasurable: {c.onUnmeasurable}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </main>
  );
}
