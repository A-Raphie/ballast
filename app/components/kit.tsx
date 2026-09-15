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

export function VerdictBadge({ result, size = "md" }: { result: "allow" | "deny" | "halt"; size?: "md" | "sm" }) {
  const map = {
    allow: { bg: "bg-[var(--status-pass-bg)] text-[var(--status-pass)]", glyph: "✓", label: "ALLOWED", title: "every rule passed; the trade went ahead" },
    deny: { bg: "bg-[var(--status-deny-bg)] text-[var(--status-deny)]", glyph: "✗", label: "DENIED", title: "at least one rule said no" },
    halt: { bg: "bg-[var(--bg-raised)] text-[var(--text-secondary)]", glyph: "‖", label: "STOPPED", title: "a rule couldn't be checked, so Ballast paused everything" },
  } as const;
  const m = map[result];
  const pad =
    size === "sm"
      ? "gap-1 px-2 py-0.5 text-[10px] tracking-[0.06em]"
      : "gap-1.5 px-3 py-1 text-[11px] tracking-[0.1em]";
  return (
    <span title={m.title} className={`inline-flex shrink-0 items-center rounded-[var(--radius-pill)] font-semibold ${pad} ${m.bg}`}>
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

// The "?" affordance: short labels stay inline, the explanation relocates here
// (progressive disclosure; nobody reads legend sentences). CSS-only popover:
// hover or keyboard focus reveals it anchored to the trigger; tab-away hides
// it via focus-within loss.
export function QHint({ text }: { text: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label="What am I looking at?"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-strong)] text-[11px] font-semibold leading-none text-[var(--text-secondary)] transition-colors duration-150 ease-out hover:border-[var(--decision)] hover:text-[var(--decision)] focus-visible:border-[var(--decision)] focus-visible:text-[var(--decision)] focus-visible:outline-none"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 bottom-full z-10 mb-2 w-72 translate-y-1 rounded-[var(--radius-panel)] border border-[var(--border-strong)] bg-[var(--bg-raised)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--text-secondary)] opacity-0 transition-all duration-150 ease-out group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
      >
        {text}
      </span>
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
  const word = pass === true ? "passed" : pass === false ? "said no" : "couldn't be checked";
  const tone =
    pass === true
      ? "text-[var(--status-pass)]"
      : pass === false
        ? "text-[var(--status-deny)]"
        : "text-[var(--text-secondary)]";
  return (
    <div className="grid grid-cols-[1.5rem_1fr] gap-3 border-b border-[var(--border-default)] py-3 last:border-b-0">
      <span className={`text-center text-sm font-bold ${tone}`} aria-label={pass === null ? "unmeasurable" : pass ? "passed" : "failed"}>
        {mark}
      </span>
      <span className="text-[13px] leading-snug">
        <span className="text-[var(--text-primary)]">{text}</span>{" "}
        <span className="text-[var(--text-muted)]">({measured})</span>
        <span className={`mono ml-2 text-[11px] ${tone}`} title={`rule code ${id} · ${word}`}>
          {id}
        </span>
      </span>
    </div>
  );
}

export function StatStrip({
  items,
  variant = "row",
}: {
  items: { label: string; value: ReactNode; tone?: "decision" | "pass" | "deny" | "default"; hint?: string }[];
  variant?: "row" | "tiles";
}) {
  const ink = (tone?: string) =>
    tone === "decision"
      ? "text-[var(--decision)]"
      : tone === "pass"
        ? "text-[var(--status-pass)]"
        : tone === "deny"
          ? "text-[var(--status-deny)]"
          : "text-[var(--text-primary)]";
  if (variant === "tiles") {
    // instrument panel: each metric a raised cell, value promoted to display size
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {items.map((it) => (
          <div
            key={it.label}
            title={it.hint}
            className="rounded-[var(--radius-panel)] border border-[var(--border-default)] bg-[var(--bg-raised)] px-3.5 py-2"
          >
            <div className="micro">{it.label}</div>
            <div className={`num mt-0.5 text-lg font-semibold tracking-tight tabular-nums ${ink(it.tone)}`}>{it.value}</div>
          </div>
        ))}
      </div>
    );
  }
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

// Tinted 24h-change pill: the exchange-convention way to carry a delta.
export function DeltaPill({ value, positive }: { value: string; positive: boolean }) {
  return (
    <span
      className={`num inline-flex min-w-14 justify-center rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
        positive ? "bg-[var(--status-pass-bg)] text-[var(--status-pass)]" : "bg-[var(--status-deny-bg)] text-[var(--status-deny)]"
      }`}
    >
      {value}
    </span>
  );
}

// One panel-header grammar: display title left, quiet aside right.
export function PanelHeader({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <h2 className="font-[family-name:var(--font-display)] text-base font-semibold">{title}</h2>
      {aside ? <div className="caption text-[var(--text-secondary)]">{aside}</div> : null}
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

// Tiny 24h price trail for a market row. Flat prices render a flat line, not
// a divide-by-zero NaN.
export function Spark({ points, w = 76, h = 20 }: { points: { px: number }[]; w?: number; h?: number }) {
  if (points.length < 2) return <svg width={w} height={h} aria-hidden />;
  const px = points.map((p) => p.px);
  const min = Math.min(...px);
  const max = Math.max(...px);
  const span = max - min || 1;
  const step = w / (points.length - 1);
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - 2 - ((p.px - min) / span) * (h - 4)).toFixed(1)}`)
    .join(" ");
  const up = px[px.length - 1] >= px[0];
  return (
    <svg width={w} height={h} aria-hidden className="shrink-0">
      <path d={d} fill="none" stroke={up ? "var(--status-pass)" : "var(--status-deny)"} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
