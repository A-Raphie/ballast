// Agent run-state (paused/resume), separate from policy: pause is a control,
// not a rule. The runner reads it every tick; the control room renders it.
//   time = O(1), space = O(1)

import { promises as fs } from "node:fs";
import path from "node:path";

export interface AgentState {
  paused: boolean;
  note?: string;
  updatedAt: number;
  lastPolicyVersion?: string;
}

const STATE = path.join(process.cwd(), "ledger", "agent-state.json");

export async function readAgentState(): Promise<AgentState> {
  try {
    const raw = JSON.parse(await fs.readFile(STATE, "utf8"));
    return { paused: Boolean(raw.paused), note: raw.note, updatedAt: raw.updatedAt ?? 0, lastPolicyVersion: raw.lastPolicyVersion };
  } catch {
    return { paused: false, updatedAt: 0 };
  }
}

export async function writeAgentState(paused: boolean, note: string, lastPolicyVersion?: string): Promise<void> {
  const prev = await readAgentState();
  await fs.mkdir(path.dirname(STATE), { recursive: true });
  await fs.writeFile(
    STATE,
    JSON.stringify({ paused, note: note ?? prev.note, updatedAt: Date.now(), lastPolicyVersion: lastPolicyVersion ?? prev.lastPolicyVersion }, null, 2),
  );
}
