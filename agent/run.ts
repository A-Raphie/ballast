// One tick: sense -> record -> propose -> gate -> (execute when the demo key exists).
// Run by `npm run tick` (cron / GitHub Actions every 15 min). Crash policy: any
// unexpected throw lands in the ledger as runner_error; the tick still releases the lock.

import { acquireLock, appendEvents, readEvents, releaseLock } from "./ledger";
import { senseMarkets } from "./sensor";
import { senseMacro, headlineHashes } from "./macro";
import { loadBook, saveBook } from "./book";
import { propose } from "./propose";
import { evaluate } from "./policy";
import { execute } from "./executor";
import { readAgentState, writeAgentState } from "./agent-state";
import { readPolicyConfig } from "./policy-config";
import type { LedgerEvent, MarketEvent, MacroEvent, ProposalEvent } from "./types";

async function main(): Promise<void> {
  const now = Date.now();
  // gauntlet mode: `tsx agent/run.ts --gauntlet "headline"` injects a scripted
  // high-severity shock (labeled source:"gauntlet-scripted" everywhere), skips
  // the proposal cooldown, and runs the full pipeline once. Honest by design:
  // every ledger line from a gauntlet run is traceable to the scripted label.
  const gauntletIdx = process.argv.indexOf("--gauntlet");
  const gauntletHeadline = gauntletIdx >= 0 ? process.argv[gauntletIdx + 1] : undefined;
  const gauntlet = Boolean(gauntletHeadline);
  if (!(await acquireLock(now))) {
    console.log("tick skipped: another run holds the lock");
    return;
  }
  const toAppend: LedgerEvent[] = [];
  try {
    const { events, tornTail } = await readEvents();
    if (tornTail) {
      toAppend.push({ kind: "correction", detail: "torn final line from a previous crash detected and skipped", ts: now });
    }

    // 1. sense markets
    const seen = headlineHashes(events);
    const [mkt, macroNew] = await Promise.all([senseMarkets(now), senseMacro(now, seen)]);
    if (mkt.error) toAppend.push({ kind: "sensor_error", detail: mkt.error, ts: now });
    toAppend.push(...mkt.events);
    toAppend.push(...macroNew);
    if (gauntlet) {
      toAppend.push({
        kind: "macro",
        source: "gauntlet-scripted",
        headline: gauntletHeadline!,
        severity: "high",
        assetsAffected: ["*"],
        ts: now,
      });
    }

    // 2. context
    const pxOf = new Map<string, number>();
    for (const e of events as MarketEvent[]) if (e.kind === "market" && typeof e.px === "number") pxOf.set(e.symbol, e.px);
    for (const e of mkt.events) pxOf.set(e.symbol, e.px);
    const macroRecent = (events.filter((e) => e.kind === "macro") as MacroEvent[])
      .concat(macroNew)
      .filter((m) => now - m.ts < 48 * 3600 * 1000)
      .sort((a, b) => b.ts - a.ts);
    const dataAgeMs = mkt.events.length > 0 ? 0 : now - (latestMarketTs(events) ?? 0);
    const book = await loadBook(now);
    await saveBook(book);
    const state = await readAgentState();
    const cfg = await readPolicyConfig();
    if (state.lastPolicyVersion && state.lastPolicyVersion !== cfg.version) {
      toAppend.push({
        kind: "policy_change",
        version: cfg.version,
        changes: {},
        ts: now,
      });
    }
    if (state.lastPolicyVersion !== cfg.version) {
      await writeAgentState(state.paused, state.note ?? "policy updated from the site", cfg.version);
    }

    // 3. propose — with a cooldown invariant: never re-propose within 60 min of
    //    the last verdict. Overnight this prevents identical allow-spam while a
    //    paper order is still pending; fills resolve drift and stop proposals
    //    naturally. Gauntlet runs bypass the cooldown (deliberate pipeline run).
    //    A paused agent still senses and records; it only stops deciding.
    const lastVerdictTs = latestVerdictTs(events);
    const cooldownMs = 60 * 60 * 1000;
    const inCooldown = !gauntlet && lastVerdictTs !== undefined && now - lastVerdictTs < cooldownMs;
    if (state.paused && !gauntlet) {
      // paused: sense-only tick (the pause is agent-state, not a policy rule)
    } else if (!gauntlet && lastVerdictTs !== undefined && now - lastVerdictTs < cooldownMs) {
      // still inside cooldown: sense-only tick
    } else {
      const proposal: ProposalEvent | null = await propose(book, macroRecent, pxOf, now);
      if (proposal) {
        const proposalId = `p${now}`;
        proposal.id = proposalId;
        toAppend.push(proposal);
        // 4. gate
        const verdict = await evaluate(
          { now, book, pxOf, recentMacro: macroRecent, dataAgeMs },
          proposal,
          proposalId,
          cfg,
        );
        toAppend.push(verdict);
        // 5. execute: demo-capable key -> real paper orders; otherwise simulated
        //    fills against live prices, labeled "simulated" in every ledger line.
        if (verdict.result === "allow") {
          const exec = await execute(verdict, proposal, book, pxOf);
          if (exec) toAppend.push(exec.order, exec.fill);
        }
      }
    }
  } catch (e) {
    toAppend.push({ kind: "runner_error", detail: String(e instanceof Error ? e.stack ?? e.message : e).slice(0, 400), ts: now });
  } finally {
    await appendEvents(toAppend);
    await releaseLock();
  }
  console.log(`tick ok: ${toAppend.length} events`);
}

function latestMarketTs(events: any[]): number | undefined {
  let latest: number | undefined;
  for (const e of events) if (e.kind === "market" && (latest === undefined || e.ts > latest)) latest = e.ts;
  return latest;
}

function latestVerdictTs(events: any[]): number | undefined {
  let latest: number | undefined;
  for (const e of events) if (e.kind === "verdict" && (latest === undefined || e.ts > latest)) latest = e.ts;
  return latest;
}

main();
