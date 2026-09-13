import { readLedger, type Decision } from "@/lib/ledger";
import { readAgentState } from "@/agent/agent-state";
import { shiftPhrase, clauseReason, ruleName, verdictWord, symbolName } from "@/lib/display";
import { WatchFloor } from "@/app/components/watch-floor";
import { Panel, StatStrip, Chip } from "@/app/components/kit";
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight">
            Control room
          </h1>
          <p className="caption mt-1">
            Every news story the agent noticed, every trade it made or refused. Click any cyan
            diamond to see the full receipt behind it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Chip>practice mode · pretend money, real prices</Chip>
          <StatusBadge status={status} lastSenseAgeMin={lastSenseAge === Infinity ? 0 : lastSenseAge} selfHosted={selfHosted} />
          <PauseControl paused={state.paused} selfHosted={selfHosted} />
        </div>
      </div>
      {state.paused && (
        <Panel className="mb-6 px-5 py-3">
          <span className="caption text-[var(--status-deny)]">
            Paused{state.note ? ` · ${state.note}` : ""} · Ballast keeps watching but makes no trades.
          </span>
        </Panel>
      )}

      <Panel className="mb-6 px-5 py-4">
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
              value: v.heelPct === null ? "0.0%" : `${v.heelPct >= 0 ? "" : "+"}${(-v.heelPct).toFixed(2)}%`,
              hint: "how far the portfolio is down (or up) from the start of its trading day (UTC)",
            },
            { label: "Rules version", value: `v${v.policyVersion ?? "?"}`, hint: "which version of the rulebook the agent obeyed" },
          ]}
        />
      </Panel>

      <Panel className="mb-6 px-4 pb-5 pt-5">
        <WatchFloor macroEvents={v.macroEvents} decisions={v.decisions} nowTs={Date.now()} />
        {sessionSummary(v.decisions) && (
          <p className="caption mt-3 border-t border-[var(--border-default)] pt-3">
            This shift: {sessionSummary(v.decisions)}
          </p>
        )}
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel className="p-5">
          <h2 className="font-[family-name:var(--font-display)] mb-4 text-lg font-semibold">
            Decisions
          </h2>
          {v.decisions.length === 0 && (
            <p className="caption">
              Nothing yet. Ballast only trades after big-enough news lands; a quiet list means a
              quiet night.
            </p>
          )}
          <ul className="space-y-3">
            {rollup(v.decisions).slice(0, 8).map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-3 border-b border-[var(--border-default)] pb-3 last:border-b-0">
                <div className="min-w-0">
                  <div className="text-sm">
                    {r.count > 1 ? <span className="text-[var(--text-secondary)]">{r.count}× </span> : null}
                    <span className="capitalize">{shiftPhrase(r.from, r.to)}</span>
                  </div>
                  <div className="num caption">
                    {new Date(r.latestTs).toISOString().replace("T", " ").slice(0, 16)} UTC
                    {r.failing && r.failing.length > 0 ? (
                      <>
                        {" · "}
                        {r.failing.map((f, i) => (
                          <span key={f}>
                            {i > 0 ? ", " : r.result === "halt" ? "stopped: couldn't check " : "refused: "}
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

        <Panel className="p-5">
          <h2 className="font-[family-name:var(--font-display)] mb-4 text-lg font-semibold">
            What it&apos;s watching
          </h2>
          <ul className="space-y-2">
            {v.marketSnapshot.map((m) => (
              <li key={m.symbol} className="flex items-center justify-between border-b border-[var(--border-default)] pb-2 last:border-b-0">
                <span className="text-sm" title={m.symbol}>{symbolName(m.symbol)}</span>
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
            {v.marketSnapshot.length === 0 && <p className="caption">Waiting for the first price check.</p>}
          </ul>
        </Panel>
      </div>
    </main>
  );
}
