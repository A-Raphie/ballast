"use client";

// THE NIGHT WATCH BAND: a 24h UTC canvas. The US equity open slot (14:30-21:00)
// is the only part of the day Wall Street is awake; the rest is Ballast's shift.
// Macro events land as context markers at their time-of-day; Ballast's decisions
// plot as decision-ink diamonds. Click a diamond to open its clause chain.
// Motion: only on selection (a panel morphs open). Nothing loops.

import { useState } from "react";
import type { MacroEvent } from "@/agent/types";
import type { Decision } from "@/lib/ledger";
import { shiftPhrase, symbolName, severityWord, verdictWord, proposerName, decodeEntities } from "@/lib/display";
import { ClauseRow, VerdictBadge, Chip, QHint } from "./kit";

const W = 1200;
const H = 152;
const PAD_X = 28;
const TRACK_Y = 104;
const OPEN_START = (14 * 60 + 30) / 1440;
const OPEN_END = (21 * 60) / 1440;

const xOf = (frac: number) => PAD_X + frac * (W - 2 * PAD_X);
const xOfTs = (ts: number) => {
  const d = new Date(ts);
  const frac = (d.getUTCHours() * 60 + d.getUTCMinutes()) / 1440;
  return xOf(frac);
};

export function WatchFloor({
  macroEvents,
  decisions,
  nowTs,
}: {
  macroEvents: MacroEvent[];
  decisions: Decision[];
  nowTs: number;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = decisions.find((d) => d.id === selectedId) ?? null;
  const allowed = decisions.filter((d) => d.verdict);

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none"
        role="img"
        aria-label="Night watch band: a 24-hour view of news stories and Ballast decisions"
      >
        {/* ballast's shift: everything outside US equity open */}
        <rect x={xOf(0)} y={34} width={xOf(OPEN_START) - xOf(0)} height={TRACK_Y - 20} fill="var(--decision-subtle)" />
        <rect x={xOf(OPEN_END)} y={34} width={xOf(1) - xOf(OPEN_END)} height={TRACK_Y - 20} fill="var(--decision-subtle)" />

        {/* US equity open slot */}
        <rect
          x={xOf(OPEN_START)}
          y={34}
          width={xOf(OPEN_END) - xOf(OPEN_START)}
          height={TRACK_Y - 20}
          fill="var(--bg-raised)"
        />
        <text x={(xOf(OPEN_START) + xOf(OPEN_END)) / 2} y={28} textAnchor="middle" className="micro band-text" fill="var(--text-secondary)" fontSize="10" letterSpacing="1.4">
          US EQUITY OPEN · WALL STREET AWAKE
        </text>

        {/* hour ruler */}
        {Array.from({ length: 9 }, (_, i) => i * 3).map((h) => (
          <g key={h}>
            <line x1={xOf(h / 24)} y1={TRACK_Y - 8} x2={xOf(h / 24)} y2={TRACK_Y} stroke="var(--border-strong)" />
            <text x={xOf(h / 24)} y={TRACK_Y + 16} textAnchor="middle" fill="var(--text-secondary)" fontSize="10" className="num band-tick-label">
              {String(h).padStart(2, "0")}:00
            </text>
          </g>
        ))}

        {/* macro markers: context ink, y by severity, opacity stacks by repeat */}
        {macroEvents.map((m, i) => {
          const y = m.severity === "high" ? 52 : 74;
          const r = m.severity === "high" ? 6.5 : 5.5;
          const op = m.severity === "high" ? 1 : 0.85;
          return (
            <g key={`m${i}`}>
              <circle cx={xOfTs(m.ts)} cy={y} r={r + 3} fill="var(--bg-base)" opacity={0.6} />
              <circle cx={xOfTs(m.ts)} cy={y} r={r} fill="var(--context-marker)" opacity={op}>
                <title>{`${severityWord(m.severity)}: ${decodeEntities(m.headline)}`}</title>
              </circle>
            </g>
          );
        })}

        {/* decision diamonds: the only decision ink on the band */}
        {(() => {
          // pixel-bucketed + verdict-weighted: same-slot decisions merge into
          // ONE diamond; executed trades (allow) render at full strength,
          // refusals dimmer, stops lightest — so a dense day reads as
          // activity density with the real trades standing out. Click opens
          // the latest receipt in the bucket.
          const buckets = new Map<number, { x: number; latest: Decision; count: number; best: string }>();
          const rank: Record<string, number> = { allow: 2, deny: 1, halt: 0 };
          for (const d of allowed) {
            const x = xOfTs(d.ts);
            const key = Math.round(x / 22);
            const hit = buckets.get(key);
            const res = d.verdict?.result ?? "halt";
            if (hit) {
              hit.count++;
              if (d.ts > hit.latest.ts) hit.latest = d;
              if ((rank[res] ?? 0) > (rank[hit.best] ?? 0)) hit.best = res;
            } else {
              buckets.set(key, { x, latest: d, count: 1, best: res });
            }
          }
          const strength: Record<string, number> = { allow: 1, deny: 0.72, halt: 0.45 };
          return [...buckets.values()].map(({ x, latest: d, count, best }) => {
            const y = 100;
            const on = d.id === selectedId;
            const size = (best === "allow" ? 15 : 11) + Math.min(count - 1, 5) * 1.6;
            const op = on ? 1 : (strength[best] ?? 0.45);
            return (
              <g key={d.id} onClick={() => setSelectedId(on ? null : d.id)} style={{ cursor: "pointer" }} opacity={op}>
                <title>
                  {count > 1
                    ? `${count} decisions here · latest: ${verdictWord(d.verdict?.result ?? "")}: ${d.proposal ? shiftPhrase(d.proposal.from, d.proposal.to) : "decision"}`
                    : `${verdictWord(d.verdict?.result ?? "")}: ${d.proposal ? shiftPhrase(d.proposal.from, d.proposal.to) : "decision"}`}
                </title>
                <rect
                  x={x - size / 2}
                  y={y - size / 2}
                  width={size}
                  height={size}
                  transform={`rotate(45 ${x} ${y})`}
                  fill={on ? "var(--decision-deep)" : "var(--decision)"}
                  stroke="var(--bg-base)"
                  strokeWidth={1.5}
                />
                <rect x={x - 9} y={y - 9} width={18} height={18} transform={`rotate(45 ${x} ${y})`} fill="transparent" />
                <circle cx={x} cy={y} r={20} fill="transparent" />
              </g>
            );
          });
        })()}

        {/* now line: the only thing that moves, and only when time moves */}
        <line x1={xOfTs(nowTs)} y1={34} x2={xOfTs(nowTs)} y2={TRACK_Y} stroke="var(--text-secondary)" strokeDasharray="3 4" />
        <text x={xOfTs(nowTs)} y={TRACK_Y + 30} textAnchor="middle" fill="var(--text-secondary)" fontSize="10" className="num band-now-label">
          {new Date(nowTs).toISOString().slice(11, 16)} UTC
        </text>
      </svg>

      <div className="mt-1.5 flex flex-wrap items-center gap-5">
        <span className="micro inline-flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--context-marker)" }} aria-hidden />
          News story
        </span>
        <span className="micro inline-flex items-center gap-2 text-[var(--decision)]">
          <span className="inline-block h-2 w-2 rotate-45" style={{ background: "var(--decision)" }} aria-hidden />
          Decision
        </span>
        <QHint
          text={
            <>
              Dots are news stories the agent noticed: the bigger the dot, the bigger the story.
              Cyan diamonds are decisions the rules allowed or refused. Click any diamond for its
              full receipt.
            </>
          }
        />
      </div>

      {/* clause chain panel: morphs open from the selected fix */}
      <div
        className="overflow-hidden transition-all duration-200"
        style={{ maxHeight: selected ? 560 : 0, opacity: selected ? 1 : 0 }}
      >
        {selected && <ClauseChain decision={selected} onClose={() => setSelectedId(null)} />}
      </div>
    </div>
  );
}

function ClauseChain({ decision, onClose }: { decision: Decision; onClose: () => void }) {
  const p = decision.proposal;
  const v = decision.verdict;
  if (!v) return null;
  return (
    <div className="card mt-4 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <VerdictBadge result={v.result} />
          {p && (
            <Chip tone="decision">
              {shiftPhrase(p.from, p.to)} · {(p.ratio * 100).toFixed(0)}% of it
            </Chip>
          )}
          <span className="num caption">{new Date(decision.ts).toISOString().replace("T", " ").slice(0, 16)} UTC</span>
        </div>
        <button onClick={onClose} className="btn btn-ghost !min-h-0 !px-3 !py-1 text-xs">
          close
        </button>
      </div>
      {p && (
        <p className="caption mb-4 max-w-3xl">
          Proposed by {proposerName(p.proposer)}. {p.reason}
        </p>
      )}
      <div>
        {v.clauses.map((c) => (
          <ClauseRow key={c.id} id={c.id} text={c.text} measured={c.measured} pass={c.pass} />
        ))}
      </div>
      {decision.order && (
        <div className="mt-4 flex items-center gap-3 border-t border-[var(--border-default)] pt-3">
          <Chip tone={decision.order.execution === "paper" ? "decision" : "neutral"}>
            {decision.order.execution === "paper"
              ? `Practice order: ${decision.order.side} ${symbolName(decision.order.symbol)}`
              : decision.order.execution === "simulated"
                ? `Simulated ${decision.order.side} of ${symbolName(decision.order.symbol)} · matched against real prices, labeled as practice`
                : `Order staged, waiting for demo keys (${decision.order.side} ${symbolName(decision.order.symbol)})`}
          </Chip>
        </div>
      )}
    </div>
  );
}
