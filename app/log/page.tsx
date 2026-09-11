import { readLedger } from "@/lib/ledger";
import { Panel } from "@/app/components/kit";

export const dynamic = "force-dynamic";

const KIND_TONE: Record<string, string> = {
  market: "text-[var(--text-secondary)]",
  macro: "text-[var(--context-marker)]",
  proposal: "text-[var(--text-primary)]",
  verdict: "text-[var(--text-primary)]",
  order: "text-[var(--decision)]",
  fill: "text-[var(--decision)]",
  correction: "text-[var(--status-deny)]",
  sensor_error: "text-[var(--status-deny)]",
  runner_error: "text-[var(--status-deny)]",
};

export default async function LogPage() {
  const v = await readLedger();
  const rows = [...v.events].reverse().slice(0, 300);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
        The ledger
      </h1>
      <p className="caption mt-2 max-w-2xl">
        Append-only. Every line the agent has written since Sep 9, newest first (night one is
        archived in the repo at ledger/archive/). This is the raw surface the control room
        renders; nothing on this site can show what is not here.
      </p>

      <Panel className="mt-8 overflow-x-auto p-0">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-[var(--border-strong)]">
              <th className="micro px-4 py-3">seq</th>
              <th className="micro px-4 py-3">time UTC</th>
              <th className="micro px-4 py-3">kind</th>
              <th className="micro px-4 py-3">line</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e, i) => (
              <tr key={i} className="border-b border-[var(--border-default)] last:border-b-0">
                <td className="num mono px-4 py-2 text-[var(--text-muted)]">{(e as any).seq ?? "-"}</td>
                <td className="num mono px-4 py-2 text-[var(--text-secondary)]">
                  {new Date(e.ts).toISOString().replace("T", " ").slice(5, 16)}
                </td>
                <td className={`mono px-4 py-2 font-semibold ${KIND_TONE[e.kind] ?? ""}`}>{e.kind}</td>
                <td className="mono px-4 py-2 text-[var(--text-secondary)]">
                  {summarize(e)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <p className="caption mt-4">showing {rows.length} of {v.events.length} lines · full history in the repo at ledger/events.jsonl</p>
    </main>
  );
}

function summarize(e: any): string {
  switch (e.kind) {
    case "market":
      return `${e.symbol} ${e.px} (${(e.chg24h * 100).toFixed(2)}%)`;
    case "macro":
      return `[${e.severity}] ${e.headline}`;
    case "proposal":
      return `${e.proposer}: ${e.from} -> ${e.to} ${(e.ratio * 100).toFixed(0)}%`;
    case "verdict": {
      if (e.result === "allow") return "allow: all clauses passed";
      if (e.result === "halt") {
        const missing = e.clauses.filter((c: any) => c.pass === null).map((c: any) => c.id);
        return `halt: unmeasurable ${missing.join(", ")}`;
      }
      const failed = e.clauses.filter((c: any) => c.pass === false).map((c: any) => c.id);
      return `deny: blocked by ${failed.join(", ")}`;
    }
    case "order":
      return `${e.execution} ${e.side} ${e.symbol}`;
    default:
      return JSON.stringify(e).slice(0, 90);
  }
}
