// Policy configuration loader. policy/policy.json is the single source of truth
// for every editable number: the engine, the UI, and /api/policy all read it.
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
  clauses: { id: string; text: string; threshold: string; onUnmeasurable: string }[];
}

export const POLICY_PATH = path.join(process.cwd(), "policy", "policy.json");

export async function readPolicyConfig(): Promise<PolicyConfig> {
  return JSON.parse(await fs.readFile(POLICY_PATH, "utf8"));
}

/** Bump the patch version: 1.1.0 -> 1.1.1. Called by /api/policy on a valid write. */
export function bumpVersion(v: string): string {
  const [maj, min, patch] = v.split(".").map(Number);
  return `${maj}.${min}.${patch + 1}`;
}

export interface PolicyWrite {
  targets?: Partial<PolicyConfig["targets"]>;
  knobs?: Partial<PolicyConfig["knobs"]>;
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

/** Validate a write against the knob ranges. Returns the plain-language error, or null. */
export function validateWrite(
  current: PolicyConfig,
  write: PolicyWrite,
): { next: PolicyConfig; changes: Record<string, { from: number; to: number }> } | { error: string } {
  const next: PolicyConfig = JSON.parse(JSON.stringify(current));
  const changes: Record<string, { from: number; to: number }> = {};
  for (const [group, values] of Object.entries(write) as [string, Record<string, number>][]) {
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
