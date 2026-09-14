import { readLedger, type Decision } from "@/lib/ledger";
import { readAgentState } from "@/agent/agent-state";
import { shiftPhrase, clauseReason, ruleName, symbolHint, symbolName, sentence, executionLabel } from "@/lib/display";
import { WatchFloor } from "@/app/components/watch-floor";
import { Panel, StatStrip, Chip, Spark } from "@/app/components/kit";
import { StatusBadge, PauseControl } from "@/app/components/status-controls";

export const dynamic = "force-dynamic";

const ageOf = (ts: number | null) =>
  ts === null ? "no data" : `${Math.max(0, Math.round((Date.now() - ts) / 60000))} min ago`;

// Roll consecutive decisions with the same shape into one row (six identical
// hourly denials read as one line + a count, not six rows of nothing new).
//   time = O(n), space = O(g)
function rollup(decisions: Decision[]) {
  const groups: { key: string; from: string; to: string; result: string; failing?: string[]; count: number; latestTs: number }[] = [];
  for (const d of decisions) {
    const from = d.proposal?.from ?? "?";
    const to = d.proposal?.to ?? "?";
    const result = d.verdict?.result ?? "?";
    const failing = d.failing ?? [];
    const last = groups[groups.length - 1];
    if (last && last.from === from && last.to === to && last.result === result) {
      last.count++;
      continue;
    }
    groups.push({ key: `${d.id}-${groups.length}`, from, to, result, failing, count: 1, latestTs: d.ts });
  }
  return groups;
}

// The newest decision that actually traded: an allow verdict with an order.
function lastTrade(decisions: Decision[]): Decision | null {
  return decisions.find((d) => d.verdict?.result === "allow" && d.order) ?? null;
}

// One plain sentence about what the agent actually did in the last 24h.
function sessionSummary(decisions: Decision[]): string | null {
  const cutoff = Date.now() - 24 * 3600 * 1000;
  let trims = 0;
  let builds = 0;
  for (const d of decisions) {
    if (d.ts < cutoff || d.verdict?.result !== "allow" || !d.proposal) continue;
    if (d.proposal.to === "usdt-buffer") trims++;
    else builds++;
  }
  const acts: string[] = [];
  if (trims > 0) acts.push(`sold down an oversized holding${trims > 1 ? ` ${trims} times` : ""}`);
  if (builds > 0) acts.push(`moved the portfolio ${builds > 1 ? `${builds} steps` : "one step"} toward its target mix`);
  return acts.length ? acts.join(", ") : null;
}

export default async function ControlRoom() {
  const [v, state] = await Promise.all([readLedger(), readAgentState()]);
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const selfHosted = !process.env.NETLIFY;
  const lastSenseAge = v.lastTickTs === null ? Infinity : Math.round((Date.now() - v.lastTickTs) / 60000);
  const status = state.paused ? "paused" : lastSenseAge <= 20 ? "on-shift" : "stale";
  const trade = lastTrade(v.decisions);
  const biggestMover = [...v.marketSnapshot].sort((a, b) => Math.abs(b.chg24h) - Math.abs(a.chg24h))[0] ?? null;

  return (
    <main className="mx-auto max-w-6xl px-6 py-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">
            Control room
          </h1>
          <p className="caption mt-0.5">
            Every story it noticed, every trade it made or refused. Click a diamond for the receipt.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Chip>Practice mode · pretend money, real prices</Chip>
          <StatusBadge status={status} lastSenseAgeMin={lastSenseAge === Infinity ? 0 : lastSenseAge} selfHosted={selfHosted} />
          <PauseControl paused={state.paused} selfHosted={selfHosted} />
        </div>
      </div>
      {state.paused && (
        <Panel className="mb-4 px-5 py-2.5">
          <span className="caption text-[var(--status-deny)]">
            Paused{state.note ? ` · ${state.note}` : ""} · Ballast keeps watching but makes no trades.
          </span>
        </Panel>
      )}

      <Panel className="mb-3 px-5 py-2.5">
        <StatStrip
          items={[
            { label: "Practice portfolio", value: v.bookValue === null ? "not funded yet" : `$${v.bookValue.toFixed(0)}`, hint: "a practice account with pretend money; the prices are real" },
            { label: "Tokenized stocks", value: v.exposure ? pct(v.exposure.rtokenPct) : "0%", hint: "how much sits in tokenized US stocks (Nvidia, Tesla, and friends)" },
            {
              label: "Crypto shield",
              value: v.exposure ? pct(v.exposure.cryptoPct) : "0%",
              tone: v.exposure && v.exposure.cryptoPct > 0 ? "decision" : "default",
              hint: "bitcoin and ethereum, held to soften overnight shocks",
            },
            {
              label: "Today's move",
              value:
                v.heelPct === null
                  ? "n/a"
                  : Math.abs(v.heelPct) < 0.005
                    ? "0.00%"
                    : `${v.heelPct > 0 ? "+" : ""}${v.heelPct.toFixed(2)}%`,
              hint: "how far the holdings' market value moved since the UTC-day open (prices only, trade effects excluded)",
            },
            { label: "Rules version", value: `v${v.policyVersion ?? "?"}`, hint: "which version of the rulebook the agent obeyed" },
          ]}
        />
      </Panel>

      <Panel className="mb-3 px-4 pb-2.5 pt-2.5">
        <WatchFloor macroEvents={v.macroEvents} decisions={v.decisions} nowTs={Date.now()} />
        {sessionSummary(v.decisions) && (
          <p className="caption mt-2 border-t border-[var(--border-default)] pt-2">
            This shift: {sessionSummary(v.decisions)}
          </p>
        )}
      </Panel>

      <div className="grid gap-3 md:grid-cols-2">
        <Panel className="p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold">
              Decisions
            </h2>
            <a href="/log" className="caption text-[var(--text-secondary)] underline decoration-dotted hover:text-[var(--text-primary)]">
              Full history in the log →
            </a>
          </div>
          {trade && (
            <div className="mb-2.5 rounded-[var(--radius-panel)] border border-[rgb(var(--decision-rgb)/0.35)] bg-[var(--decision-subtle)] px-3.5 py-2">
              <div className="micro mb-0.5 text-[var(--decision)]">Last trade</div>
              <div className="text-sm">
                {trade.order!.side === "buy" ? "Bought" : "Sold"} {symbolName(trade.order!.symbol)}
              </div>
              <div className="num caption mt-0.5">
                {new Date(trade.ts).toISOString().replace("T", " ").slice(0, 16)} UTC ·{" "}
                {executionLabel(trade.order!.execution).toLowerCase()}, labeled as practice
              </div>
            </div>
          )}
          {v.decisions.length === 0 && (
            <p className="caption">
              Nothing yet. Ballast only trades after big-enough news lands; a quiet list means a
              quiet night.
            </p>
          )}
          <ul className="space-y-1.5">
            {rollup(v.decisions).slice(0, 4).map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] pb-1.5 last:border-b-0">
                <div className="min-w-0">
                  <div className="text-sm">
                    {r.count > 1 ? <span className="text-[var(--text-secondary)]">{r.count}× </span> : null}
                    <span>{sentence(shiftPhrase(r.from, r.to))}</span>
                  </div>
                  <div className="num caption">
                    {new Date(r.latestTs).toISOString().replace("T", " ").slice(0, 16)} UTC
                    {r.failing && r.failing.length > 0 ? (
                      <>
                        {" · "}
                        {r.failing.map((f, i) => (
                          <span key={f}>
                            {i > 0 ? ", " : r.result === "halt" ? "Stopped: couldn't check " : "Refused: "}
                            <a
                              href={`/policy#${f}`}
                              title={`rule ${f}: ${ruleName(f)}`}
                              className="underline decoration-dotted hover:text-[var(--text-primary)]"
                            >
                              {r.result === "halt" ? ruleName(f) : clauseReason(f)}
                            </a>
                          </span>
                        ))}
                      </>
                    ) : ""}
                  </div>
                </div>
                <span
                  className={`text-sm font-bold ${
                    r.result === "allow"
                      ? "text-[var(--status-pass)]"
                      : r.result === "deny"
                        ? "text-[var(--status-deny)]"
                        : "text-[var(--text-secondary)]"
                  }`}
                >
                  {r.result === "allow" ? "✓ traded" : r.result === "deny" ? "✗ refused" : "‖ stopped"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="p-4">
          <h2 className="font-[family-name:var(--font-display)] mb-2 text-base font-semibold">
            What it&apos;s watching
          </h2>
          <ul className="space-y-1">
            {v.marketSnapshot.map((m) => (
              <li key={m.symbol} className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] py-0.5 last:border-b-0">
                <span className="num text-sm" title={symbolHint(m.symbol)}>{symbolName(m.symbol)}</span>
                <span className="flex items-center gap-3">
                  <Spark points={v.priceSeries[m.symbol] ?? []} h={16} />
                  <span className="num text-sm">{m.px.toLocaleString()}</span>
                  <span
                    className={`num w-16 text-right text-xs ${m.chg24h >= 0 ? "text-[var(--status-pass)]" : "text-[var(--status-deny)]"}`}
                  >
                    {m.chg24h >= 0 ? "+" : ""}
                    {(m.chg24h * 100).toFixed(2)}%
                  </span>
                </span>
              </li>
            ))}
            {v.marketSnapshot.length === 0 && <p className="caption">Waiting for the first price check.</p>}
          </ul>
          {biggestMover && (
            <p className="caption mt-2">
              Biggest 24h move: {symbolName(biggestMover.symbol)}{" "}
              <span className={biggestMover.chg24h >= 0 ? "text-[var(--status-pass)]" : "text-[var(--status-deny)]"}>
                {biggestMover.chg24h >= 0 ? "+" : ""}
                {(biggestMover.chg24h * 100).toFixed(2)}%
              </span>
            </p>
          )}
        </Panel>
      </div>
    </main>
  );
}
