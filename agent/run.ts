// One tick: sense -> record -> propose -> gate -> (execute when the demo key exists).
// Run by `npm run tick` (cron / GitHub Actions every 15 min). Crash policy: any
// unexpected throw lands in the ledger as runner_error; the tick still releases the lock.

import { acquireLock, appendEvents, readEvents, releaseLock } from "./ledger";
import { senseMarkets } from "./sensor";
import { senseMacro, headlineHashes } from "./macro";
import { loadBook, saveBook } from "./book";
import { propose } from "./propose";
import { evaluate } from "./policy";
import type { LedgerEvent, MarketEvent, MacroEvent, ProposalEvent } from "./types";

async function main(): Promise<void> {
  const now = Date.now();
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

    // 3. propose
    const proposal: ProposalEvent | null = await propose(book, macroRecent, pxOf, now);
    if (proposal) {
      const proposalId = `p${now}`;
      proposal.id = proposalId;
      toAppend.push(proposal);
      // 4. gate
      const verdict = evaluate(
        { now, book, pxOf, recentMacro: macroRecent, dataAgeMs },
        proposal,
        proposalId,
      );
      toAppend.push(verdict);
      // 5. execute: real paper orders need the demo key; until then the allow is
      //    recorded honestly as pending-key, never as a fill.
      if (verdict.result === "allow") {
        toAppend.push({
          kind: "order",
          decisionId: proposalId,
          side: proposal.to === "crypto" ? "buy" : "sell",
          symbol: proposal.to === "crypto" ? "BTCUSDT" : "RNVDAUSDT",
          market: proposal.to === "crypto" ? "crypto" : "rtoken",
          qty: 0, // sized by the executor once the demo key is live
          type: "market",
          execution: process.env.BITGET_DEMO_KEY ? "paper" : "pending-key",
          ts: now,
        });
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

main();
