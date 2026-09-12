// Policy configuration loader. policy/policy.json is the single source of truth
// for every editable rule: the engine, the UI, and /api/policy all read it.
// Fresh read per call (files are small; the runner and the site are separate
// processes, so no caching across the write boundary).
//   time = O(1) per read, space = O(1)

import { promises as fs } from "node:fs";
import path from "node:path";

export interface PolicyConfig {
  version: string;
  targets: { rtokenPct: number; hedgePct: number; usdtPct: number };
  knobs: {
    driftPp: number;
    drawdownMax: number;
    hedgeBandMin: number;
    hedgeBandMax: number;
    eventLookbackHours: number;
    blackoutMinutes: number;
    concentrationMax: number;
    staleMaxSeconds: number;
  };
  clauses: {
    id: string;
    text: string;
    threshold: string;
    onUnmeasurable: string;
    enabled: boolean;
  }[];
  library: LibraryClause[];
}

// Library rules: typed, parameterized, fully addable/removable from the site.
// No user-authored code ever executes — visitors compose from this registry.
export type LibraryType = "max-trades-per-day" | "min-cash-buffer" | "volatility-halt" | "daily-turnover-cap";

export interface LibraryClause {
  id: string;
  type: LibraryType;
  params: Record<string, number>;
  enabled: boolean;
  text: string;
}

export const LIBRARY_TYPES: Record<
  LibraryType,
  {
    label: string;
    template: (p: Record<string, number>) => string;
    paramSpecs: { key: string; label: string; min: number; max: number; default: number; kind: "count" | "pct" | "usdt" }[];
  }
> = {
  "max-trades-per-day": {
    label: "Max trades per day",
    template: (p) => `No more than ${p.max} trades in one UTC day.`,
    paramSpecs: [{ key: "max", label: "max trades", min: 1, max: 20, default: 4, kind: "count" }],
  },
  "min-cash-buffer": {
    label: "Min cash buffer",
    template: (p) => `Never let cash fall below ${p.minPct}% of the book.`,
    paramSpecs: [{ key: "minPct", label: "min cash", min: 1, max: 50, default: 8, kind: "pct" }],
  },
  "volatility-halt": {
    label: "Volatility halt",
    template: (p) => `Stand down while any held symbol moved more than ${p.maxMovePct}% in 24 hours.`,
    paramSpecs: [{ key: "maxMovePct", label: "max 24h move", min: 1, max: 25, default: 6, kind: "pct" }],
  },
  "daily-turnover-cap": {
    label: "Daily turnover cap",
    template: (p) => `Total trades in one UTC day stay under $${p.maxNotional}.`,
    paramSpecs: [{ key: "maxNotional", label: "max $ traded", min: 100, max: 50000, default: 8000, kind: "usdt" }],
  },
};

export const POLICY_PATH = path.join(process.cwd(), "policy", "policy.json");

export async function readPolicyConfig(): Promise<PolicyConfig> {
  return JSON.parse(await fs.readFile(POLICY_PATH, "utf8"));
}

/** Bump the patch version: 1.2.0 -> 1.2.1. Called by /api/policy on a valid write. */
export function bumpVersion(v: string): string {
  const [maj, min, patch] = v.split(".").map(Number);
  return `${maj}.${min}.${patch + 1}`;
}

export interface PolicyWrite {
  targets?: Partial<PolicyConfig["targets"]>;
  knobs?: Partial<PolicyConfig["knobs"]>;
  setClauseEnabled?: { id: string; enabled: boolean }[];
  addClauses?: { type: LibraryType; params?: Record<string, number> }[];
  removeClauses?: { id: string }[];
}

const RANGES: Record<string, [number, number]> = {
  "targets.rtokenPct": [0, 1],
  "targets.hedgePct": [0, 1],
  "targets.usdtPct": [0, 1],
  "knobs.driftPp": [0.01, 0.5],
  "knobs.drawdownMax": [0.005, 0.2],
  "knobs.hedgeBandMin": [0, 0.9],
  "knobs.hedgeBandMax": [0.1, 1],
  "knobs.eventLookbackHours": [1, 72],
  "knobs.blackoutMinutes": [0, 120],
  "knobs.concentrationMax": [0.1, 1],
  "knobs.staleMaxSeconds": [60, 3600],
};

/** Validate a write against knob ranges and the library registry. */
export function validateWrite(
  current: PolicyConfig,
  write: PolicyWrite,
): { next: PolicyConfig; changes: Record<string, { from: unknown; to: unknown }> } | { error: string } {
  const next: PolicyConfig = { library: [], ...JSON.parse(JSON.stringify(current)) };
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  for (const [group, values] of Object.entries(write) as [string, Record<string, number>][]) {
    if (group !== "targets" && group !== "knobs") continue;
    for (const [k, v] of Object.entries(values ?? {})) {
      const key = `${group}.${k}`;
      const range = RANGES[key];
      if (!range) return { error: `unknown policy knob: ${key}` };
      if (typeof v !== "number" || !Number.isFinite(v)) return { error: `${key} must be a number` };
      if (v < range[0] || v > range[1]) return { error: `${key} must be between ${range[0]} and ${range[1]}` };
      const from = (current as any)[group][k];
      if (from !== v) changes[key] = { from, to: v };
      (next as any)[group][k] = v;
    }
  }

  for (const { id, enabled } of write.setClauseEnabled ?? []) {
    const core = next.clauses.find((c) => c.id === id);
    const lib = next.library.find((c) => c.id === id);
    const target = core ?? lib;
    if (!target) return { error: `unknown clause: ${id}` };
    if (typeof enabled !== "boolean") return { error: "enabled must be true or false" };
    if (target.enabled !== enabled) changes[`${id}.enabled`] = { from: target.enabled, to: enabled };
    target.enabled = enabled;
  }

  for (const add of write.addClauses ?? []) {
    const spec = LIBRARY_TYPES[add.type];
    if (!spec) return { error: `unknown rule type: ${add.type}` };
    const params: Record<string, number> = {};
    for (const ps of spec.paramSpecs) {
      const v = add.params?.[ps.key] ?? ps.default;
      if (typeof v !== "number" || !Number.isFinite(v) || v < ps.min || v > ps.max)
        return { error: `${ps.label} must be between ${ps.min} and ${ps.max}` };
      params[ps.key] = v;
    }
    const n = next.library.length + 1;
    const id = `L${n}-${add.type}`;
    if (next.library.some((c) => c.id === id)) return { error: `a rule named ${id} already exists` };
    next.library.push({ id, type: add.type, params, enabled: true, text: spec.template(params) });
    changes[`+${id}`] = { from: "absent", to: "added" };
  }

  for (const rm of write.removeClauses ?? []) {
    const id = rm.id;
    if (next.clauses.some((c) => c.id === id))
      return { error: "core guards cannot be deleted from the site: they can only be switched off" };
    const idx = next.library.findIndex((c) => c.id === id);
    if (idx === -1) return { error: `no added rule named ${id}` };
    changes[`-${id}`] = { from: "present", to: "removed" };
    next.library.splice(idx, 1);
  }

  if (next.knobs.hedgeBandMin >= next.knobs.hedgeBandMax)
    return { error: "hedgeBandMin must stay below hedgeBandMax" };
  const targetSum = next.targets.rtokenPct + next.targets.hedgePct + next.targets.usdtPct;
  if (Math.abs(targetSum - 1) > 0.001)
    return { error: `targets must sum to 100% (currently ${(targetSum * 100).toFixed(1)}%)` };
  return { next, changes };
}

export async function writePolicyConfig(next: PolicyConfig): Promise<void> {
  await fs.writeFile(POLICY_PATH, JSON.stringify(next, null, 2) + "\n");
}

// ---- Remote (GitHub) layer ------------------------------------------------
// The public deploy holds no writable files, so the site reads the live
// rulebook from the repo and commits rule edits back through the Contents
// API. The runner on the agent's host pulls the repo each tick and obeys.

let remoteCache: { at: number; config: PolicyConfig } | null = null;
const REMOTE_TTL_MS = 60_000;

function gh(): { token: string; repo: string } | null {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  if (!token || !repo) return null;
  return { token, repo };
}

export function remotePolicyEnabled(): boolean {
  return Boolean(gh());
}

export async function readPolicyLive(): Promise<PolicyConfig | null> {
  const g = gh();
  if (!g) return null;
  if (remoteCache && Date.now() - remoteCache.at < REMOTE_TTL_MS) return remoteCache.config;
  try {
    const res = await fetch(`https://api.github.com/repos/${g.repo}/contents/policy/policy.json`, {
      headers: { authorization: `Bearer ${g.token}`, accept: "application/vnd.github+json", user_agent: "ballast" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { content?: string; encoding?: string };
    if (body.encoding !== "base64" || !body.content) return null;
    const config = JSON.parse(Buffer.from(body.content, "base64").toString("utf8")) as PolicyConfig;
    remoteCache = { at: Date.now(), config };
    return config;
  } catch {
    return null;
  }
}

/** Refresh the remote cache after a successful commit so immediate follow-up writes read fresh. */
export function setRemotePolicyCache(config: PolicyConfig): void {
  remoteCache = { at: Date.now(), config };
}

export async function commitPolicyLive(
  next: PolicyConfig,
  message: string,
): Promise<{ ok: true; commitUrl: string } | { ok: false; error: string }> {
  const g = gh();
  if (!g) return { ok: false, error: "no GitHub credential configured" };
  try {
    const current = await fetch(`https://api.github.com/repos/${g.repo}/contents/policy/policy.json`, {
      headers: { authorization: `Bearer ${g.token}`, accept: "application/vnd.github+json", user_agent: "ballast" },
      signal: AbortSignal.timeout(8000),
    });
    const sha = current.ok ? ((await current.json()) as { sha: string }).sha : undefined;
    const res = await fetch(`https://api.github.com/repos/${g.repo}/contents/policy/policy.json`, {
      method: "PUT",
      headers: { authorization: `Bearer ${g.token}`, accept: "application/vnd.github+json", user_agent: "ballast", "content-type": "application/json" },
      body: JSON.stringify({
        message,
        content: Buffer.from(JSON.stringify(next, null, 2) + "\n", "utf8").toString("base64"),
        ...(sha ? { sha } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = (await res.json()) as { commit?: { html_url?: string }; message?: string };
    if (!res.ok) return { ok: false, error: body.message ?? `HTTP ${res.status}` };
    return { ok: true, commitUrl: body.commit?.html_url ?? "" };
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 120) };
  }
}
