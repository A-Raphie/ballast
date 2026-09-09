// Append-only JSONL ledger.
//   time = O(1) amortized per append; seq assigned from a tail read of the last line
//   structure: newline-terminated single write() per event via appendFile (O_APPEND)
//   family: stream append; correctness invariant: committed lines are never rewritten
//
// Overlap guard: a lockfile with O_EXCL; stale locks (>10 min) are stolen and the
// theft is itself logged. A torn final line (crash mid-write) is surfaced as a
// `correction` event at read time, never silently skipped.

import { promises as fs } from "node:fs";
import path from "node:path";

const LEDGER_DIR = path.join(process.cwd(), "ledger");
const EVENTS = path.join(LEDGER_DIR, "events.jsonl");
const LOCK = path.join(LEDGER_DIR, ".tick.lock");
const LOCK_STALE_MS = 10 * 60 * 1000;

export async function acquireLock(now: number): Promise<boolean> {
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  try {
    const handle = await fs.open(LOCK, "wx");
    await handle.write(String(now));
    await handle.close();
    return true;
  } catch {
    try {
      const stat = await fs.stat(LOCK);
      if (now - stat.mtimeMs > LOCK_STALE_MS) {
        await fs.appendFile(EVENTS, JSON.stringify({ kind: "correction", detail: "stale tick lock stolen", ts: now }) + "\n");
        await fs.unlink(LOCK);
        return acquireLock(now);
      }
    } catch {
      /* lock vanished between stat and unlink: treat as lost race */
    }
    return false;
  }
}

export async function releaseLock(): Promise<void> {
  await fs.unlink(LOCK).catch(() => {});
}

export async function readEvents(): Promise<{ events: any[]; tornTail: boolean }> {
  let raw: string;
  try {
    raw = await fs.readFile(EVENTS, "utf8");
  } catch {
    return { events: [], tornTail: false };
  }
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const events: any[] = [];
  let tornTail = false;
  for (let i = 0; i < lines.length; i++) {
    try {
      events.push(JSON.parse(lines[i]));
    } catch {
      if (i === lines.length - 1) tornTail = true; // last line torn by a crash
      else throw new Error(`corrupt ledger line ${i + 1}: ${lines[i].slice(0, 80)}`);
    }
  }
  return { events, tornTail };
}

export async function appendEvents(events: any[]): Promise<number> {
  if (events.length === 0) return 0;
  const { events: existing } = await readEvents();
  let seq = 0;
  for (const e of existing) if (typeof e.seq === "number" && e.seq >= seq) seq = e.seq + 1;
  let out = "";
  for (const e of events) out += JSON.stringify({ seq: seq++, ...e }) + "\n";
  await fs.mkdir(LEDGER_DIR, { recursive: true });
  await fs.appendFile(EVENTS, out);
  return events.length;
}
