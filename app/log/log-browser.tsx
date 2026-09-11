"use client";

// Log browser: kind filters, text search, newest/oldest sort. Client-side over
// the server-rendered rows; nothing here can show what is not in the ledger.
//   time = O(n) per filter pass, n = rendered rows (capped 300 upstream)

import { useMemo, useState } from "react";

export interface LogRow {
  seq: string;
  time: string;
  kind: string;
  tone: string;
  summary: string;
}

const KINDS = ["all", "macro", "market", "proposal", "verdict", "order", "fill"];

export function LogBrowser({ rows }: { rows: LogRow[] }) {
  const [kind, setKind] = useState("all");
  const [q, setQ] = useState("");
  const [newest, setNewest] = useState(true);

  const filtered = useMemo(() => {
    let out = kind === "all" ? rows : rows.filter((r) => r.kind === kind);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      out = out.filter((r) => r.summary.toLowerCase().includes(needle) || r.kind === needle);
    }
    return newest ? out : [...out].reverse();
  }, [rows, kind, q, newest]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded-[var(--radius-pill)] border px-3 py-1 text-xs ${
              kind === k
                ? "border-[rgb(var(--decision-rgb)/0.5)] bg-[var(--decision-subtle)] text-[var(--decision)]"
                : "border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {k}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search the ledger…"
          className="card ml-auto w-48 bg-[var(--bg-base)] px-3 py-1.5 text-xs outline-none"
          aria-label="Search ledger lines"
        />
        <button
          onClick={() => setNewest((s) => !s)}
          className="btn btn-ghost !min-h-0 !px-3 !py-1 text-xs"
          aria-label="toggle sort order"
        >
          {newest ? "newest first" : "oldest first"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-[var(--border-default)]">
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
            {filtered.map((r, i) => (
              <tr key={i} className="border-b border-[var(--border-default)] last:border-b-0">
                <td className="mono px-4 py-2 text-[var(--text-muted)]">{r.seq}</td>
                <td className="mono px-4 py-2 text-[var(--text-secondary)]">{r.time}</td>
                <td className={`mono px-4 py-2 font-semibold ${r.tone}`}>{r.kind}</td>
                <td className="mono px-4 py-2 text-[var(--text-secondary)]">{r.summary}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="caption px-4 py-6 text-center">
                  No lines match. Clear the filter to see the full ledger.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="caption mt-4">
        showing {filtered.length} of {rows.length} rendered lines · full history in the repo at ledger/ (night one archived)
      </p>
    </div>
  );
}
