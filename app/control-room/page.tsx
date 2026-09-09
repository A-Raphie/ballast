import { readLedger } from "@/lib/ledger";
import { WatchFloor } from "@/app/components/watch-floor";
import { Panel, StatStrip, AgentDot, Chip } from "@/app/components/kit";

export const dynamic = "force-dynamic";

const ageOf = (ts: number | null) =>
  ts === null ? "no data" : `${Math.max(0, Math.round((Date.now() - ts) / 60000))} min ago`;

export default async function ControlRoom() {
  const v = await readLedger();
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const live = v.lastTickTs !== null && Date.now() - v.lastTickTs < 20 * 60 * 1000;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
            Control room
          </h1>
          <p className="caption mt-1">
            Every macro marker the agent sensed, every decision the policy allowed or denied.
          </p>
        </div>
        <AgentDot live={live} />
      </div>

      <Panel className="mb-6 px-5 py-4">
        <StatStrip
          items={[
            { label: "Book", value: v.bookValue === null ? "unfunded" : `$${v.bookValue.toFixed(0)}` },
            {
              label: "rToken sleeve",
              value: v.exposure ? pct(v.exposure.rtokenPct) : "0%",
            },
            {
              label: "Hedge sleeve",
              value: v.exposure ? pct(v.exposure.cryptoPct) : "0%",
              tone: v.exposure && v.exposure.cryptoPct > 0 ? "decision" : "default",
            },
            {
              label: "Heel (24h)",
              value: v.heelPct === null ? "0.0%" : `${v.heelPct >= 0 ? "" : "+"}${(-v.heelPct).toFixed(2)}%`,
            },
            { label: "Last sense", value: ageOf(v.lastTickTs) },
            { label: "Policy", value: `v${v.policyVersion ?? "?"}` },
          ]}
        />
      </Panel>

      <Panel className="mb-6 px-4 pb-5 pt-5">
        <WatchFloor macroEvents={v.macroEvents} decisions={v.decisions} nowTs={Date.now()} />
        <div className="mt-3 flex flex-wrap gap-4 border-t border-[var(--border-default)] pt-3">
          <Chip tone="context">· macro event (marker size = severity)</Chip>
          <Chip tone="decision">◆ Ballast decision · click for clause chain</Chip>
        </div>
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel className="p-5">
          <h2 className="font-[family-name:var(--font-display)] mb-4 text-lg font-semibold">
            Decisions
          </h2>
          {v.decisions.length === 0 && (
            <p className="caption">
              No decisions yet. The agent proposes only when a qualifying macro event lands; a
              quiet book is the honest state.
            </p>
          )}
          <ul className="space-y-3">
            {v.decisions.slice(0, 8).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] pb-3 last:border-b-0">
                <div className="min-w-0">
                  <div className="num text-sm">
                    {d.proposal ? `${d.proposal.from.replace("-", " ")} → ${d.proposal.to.replace("-", " ")}` : "decision"}
                  </div>
                  <div className="num caption">{new Date(d.ts).toISOString().replace("T", " ").slice(0, 16)} UTC</div>
                </div>
                <span
                  className={`text-sm font-bold ${
                    d.verdict?.result === "allow"
                      ? "text-[var(--status-pass)]"
                      : d.verdict?.result === "deny"
                        ? "text-[var(--status-deny)]"
                        : "text-[var(--text-secondary)]"
                  }`}
                >
                  {d.verdict?.result === "allow" ? "✓ allow" : d.verdict?.result === "deny" ? "✗ deny" : "‖ halt"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-5">
          <h2 className="font-[family-name:var(--font-display)] mb-4 text-lg font-semibold">
            Sensed market
          </h2>
          <ul className="space-y-2">
            {v.marketSnapshot.map((m) => (
              <li key={m.symbol} className="flex items-center justify-between border-b border-[var(--border-default)] pb-2 last:border-b-0">
                <span className="num text-sm">{m.symbol}</span>
                <span className="flex items-baseline gap-3">
                  <span className="num text-sm">{m.px.toLocaleString()}</span>
                  <span
                    className={`num text-xs ${m.chg24h >= 0 ? "text-[var(--status-pass)]" : "text-[var(--status-deny)]"}`}
                  >
                    {m.chg24h >= 0 ? "+" : ""}
                    {(m.chg24h * 100).toFixed(2)}%
                  </span>
                </span>
              </li>
            ))}
            {v.marketSnapshot.length === 0 && <p className="caption">Awaiting the first sense tick.</p>}
          </ul>
        </Panel>
      </div>
    </main>
  );
}
