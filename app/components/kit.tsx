// Ballast component kit. The ONLY source of UI primitives; screens import from
// here (query-before-create). Grammar harvested from beautifului.dev patterns
// (Thinking traces, Approval cards, Task rows, Diff tables), re-expressed entirely
// on project tokens. Zero raw hex: the grep gate governs this file too.

import type { ReactNode } from "react";

export function Micro({ children }: { children: ReactNode }) {
  return <div className="micro">{children}</div>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className}`}>{children}</div>;
}

export function VerdictBadge({ result }: { result: "allow" | "deny" | "halt" }) {
  const map = {
    allow: { bg: "bg-[var(--status-pass-bg)] text-[var(--status-pass)]", glyph: "✓", label: "ALLOWED" },
    deny: { bg: "bg-[var(--status-deny-bg)] text-[var(--status-deny)]", glyph: "✗", label: "DENIED" },
    halt: { bg: "bg-[var(--bg-raised)] text-[var(--text-secondary)]", glyph: "‖", label: "HALTED" },
  } as const;
  const m = map[result];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1 text-[11px] font-semibold tracking-[0.1em] ${m.bg}`}>
      <span aria-hidden>{m.glyph}</span> {m.label}
    </span>
  );
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "decision" | "context" }) {
  const map = {
    neutral: "border-[var(--border-strong)] text-[var(--text-secondary)]",
    decision: "border-[rgb(var(--decision-rgb)/0.4)] text-[var(--decision)] bg-[var(--decision-subtle)]",
    context: "border-[var(--border-strong)] text-[var(--context-marker)]",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-[11px] ${map[tone]}`}>
      {children}
    </span>
  );
}

export function ClauseRow({
  id,
  text,
  measured,
  pass,
}: {
  id: string;
  text: string;
  measured: string;
  pass: boolean | null;
}) {
  const mark = pass === true ? "✓" : pass === false ? "✗" : "‖";
  const tone =
    pass === true
      ? "text-[var(--status-pass)]"
      : pass === false
        ? "text-[var(--status-deny)]"
        : "text-[var(--text-secondary)]";
  return (
    <div className="grid grid-cols-[1.5rem_7rem_1fr] gap-3 border-b border-[var(--border-default)] py-3 last:border-b-0">
      <span className={`text-center text-sm font-bold ${tone}`} aria-label={pass === null ? "unmeasurable" : pass ? "passed" : "failed"}>
        {mark}
      </span>
      <span className="mono pt-0.5 text-[var(--text-secondary)]">{id}</span>
      <span className="text-[13px] leading-snug">
        <span className="text-[var(--text-primary)]">{measured}</span>
        <span className="text-[var(--text-muted)]"> · {text}</span>
      </span>
    </div>
  );
}

export function StatStrip({
  items,
}: {
  items: { label: string; value: ReactNode; tone?: "decision" | "default"; hint?: string }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-baseline gap-2" title={it.hint}>
          <span className="micro">{it.label}</span>
          <span
            className={`num text-sm font-semibold ${it.tone === "decision" ? "text-[var(--decision)]" : "text-[var(--text-primary)]"}`}
          >
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AgentDot({ live, note }: { live: boolean; note?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`inline-block h-2 w-2 rounded-full ${live ? "bg-[var(--decision)]" : "bg-[var(--text-muted)]"}`}
        aria-hidden
      />
      <span className="micro">{live ? "Ballast on shift" : note ?? "standing by"}</span>
    </span>
  );
}
