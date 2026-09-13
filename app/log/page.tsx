import { readLedger } from "@/lib/ledger";
import { symbolName, shiftPhrase, clauseReason, ruleName, proposerName, executionLabel, severityWord } from "@/lib/display";
import { LogBrowser, type LogRow } from "./log-browser";

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

function summarize(e: any): string {
  switch (e.kind) {
    case "market":
      return `${symbolName(e.symbol)} at $${e.px} (${(e.chg24h * 100).toFixed(2)}% today)`;
    case "macro":
      return `${severityWord(e.severity)}: ${e.headline}`;
    case "proposal":
      return `${proposerName(e.proposer)} proposed: ${shiftPhrase(e.from, e.to)} (${(e.ratio * 100).toFixed(0)}%)`;
    case "verdict": {
      if (e.result === "allow") return "allowed: every rule passed";
      if (e.result === "halt") {
        const missing = [...new Set<string>(e.clauses.filter((c: any) => c.pass === null).map((c: any) => String(c.id)))];
        return `stopped: couldn't check ${missing.map((id) => ruleName(id)).join(", ")}`;
      }
      const failed = [...new Set<string>(e.clauses.filter((c: any) => c.pass === false).map((c: any) => String(c.id)))];
      return `denied: ${failed.map((id) => clauseReason(id)).join("; ")}`;
    }
    case "order":
      return `${executionLabel(e.execution)}: ${e.side} ${symbolName(e.symbol)}`;
    default:
      return JSON.stringify(e).slice(0, 90);
  }
}

export default async function LogPage() {
  const v = await readLedger();
  const rows: LogRow[] = [...v.events]
    .reverse()
    .slice(0, 300)
    .map((e, i) => ({
      seq: String((e as any).seq ?? "-"),
      time: new Date(e.ts).toISOString().replace("T", " ").slice(5, 16),
      kind: e.kind,
      tone: KIND_TONE[e.kind] ?? "",
      summary: summarize(e),
    }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
        The log
      </h1>
      <p className="caption mt-2 max-w-2xl">
        Everything Ballast has written since its first check on Sep 9, newest first (night one is
        archived in the repo under ledger/archive/). Nothing on this site can show what is not
        written here: news it noticed, prices it saw, each trade idea, the decision, and the
        order. Read a decision line as the result, then the exact rule that drove it. The rule
        codes (B1, B2, ...) and raw symbol tickers stay in the receipts so judges can trace any
        decision back to the exact written rule.
      </p>
      <div className="mt-8">
        <LogBrowser rows={rows} />
      </div>
    </main>
  );
}
