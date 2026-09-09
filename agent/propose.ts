// Decision core. Two proposers behind LLM_PROVIDER:
//   "qwen"  -> qwen3.8-max via the Bitget hackathon endpoint (env LLM_API_KEY)
//   absent  -> threshold-fallback: proposes drift correction toward the written
//              target when a qualifying macro event exists in the ledger window.
// The proposer NEVER decides: policy.evaluate disposes every proposal.
//   time = O(1) per proposal (context is precomputed), space = O(1)

import type { MacroEvent, ProposalEvent, BookState } from "./types";
import { bookPctFrom } from "./book";

export async function propose(
  book: BookState,
  macroEvents: MacroEvent[],
  pxOf: Map<string, number>,
  now: number,
): Promise<ProposalEvent | null> {
  if (process.env.LLM_PROVIDER === "qwen" && process.env.LLM_API_KEY) {
    return proposeWithLlm(book, macroEvents, pxOf, now);
  }
  return proposeThresholdFallback(book, macroEvents, pxOf, now);
}

function proposeThresholdFallback(
  book: BookState,
  macroEvents: MacroEvent[],
  pxOf: Map<string, number>,
  now: number,
): ProposalEvent | null {
  const cutoff = now - 12 * 3600 * 1000;
  const qualifying = macroEvents.filter((m) => m.ts >= cutoff && m.severity !== "low");
  if (qualifying.length === 0) return null; // nothing to react to; B4 will halt anyway
  const { rtoken, crypto } = bookPctFrom(book, pxOf);

  // Bootstrap order matters: build the hedge sleeve into its band first, then
  // close rToken drift. Proposing an rToken build while crypto is under-band
  // would (correctly) be denied by B3, so never propose it.
  if (crypto < book.targetHedgePct - 0.05) {
    if (book.usdt <= 0) return null; // no cash source: nothing honest to propose
    return {
      kind: "proposal",
      proposer: "threshold-fallback",
      action: "shift",
      from: "usdt-buffer",
      to: "crypto",
      ratio: Math.min(book.targetHedgePct - crypto, 0.3),
      reason: `Hedge sleeve at ${(crypto * 100).toFixed(0)}% is below the written 20% floor with ${qualifying.length} qualifying macro event(s); building the hedge from the USDT buffer first.`,
      ts: now,
    };
  }

  const drift = rtoken - book.targetRtokenPct;
  if (Math.abs(drift) <= 0.1) return null;
  const movingCrypto = drift > 0;
  const sourceExists = movingCrypto ? rtoken > 0.02 : true; // can't shift out of an empty sleeve
  if (!sourceExists) return null;
  const ratio = Math.min(Math.abs(drift), 0.3);
  return {
    kind: "proposal",
    proposer: "threshold-fallback",
    action: "shift",
    from: movingCrypto ? "rtoken-sleeve" : "usdt-buffer",
    to: movingCrypto ? "crypto" : "rtoken-sleeve",
    ratio,
    reason: `Drift ${(Math.abs(drift) * 100).toFixed(1)}pp from written target after ${qualifying.length} qualifying macro event(s); threshold fallback proposing ${movingCrypto ? "hedge" : "restore"} shift of ${(ratio * 100).toFixed(0)}%.`,
    ts: now,
  };
}

async function proposeWithLlm(
  book: BookState,
  macroEvents: MacroEvent[],
  pxOf: Map<string, number>,
  now: number,
): Promise<ProposalEvent | null> {
  const base = process.env.LLM_BASE_URL ?? "https://hackathon.bitgetops.com/v1";
  const model = process.env.LLM_MODEL ?? "qwen3.8-max";
  const { rtoken, crypto } = bookPctFrom(book, pxOf);
  const recent = macroEvents
    .slice(0, 10)
    .map((m) => `- [${m.severity}] (${m.source}) ${m.headline}`)
    .join("\n");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.LLM_API_KEY}` },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are the decision core of a paper-trading hedge agent. You PROPOSE only; a deterministic policy engine will gate your proposal. Reply with strict JSON: {\"propose\": boolean, \"from\": \"rtoken-sleeve\"|\"hedge-sleeve\", \"to\": \"crypto\"|\"rtoken-sleeve\", \"ratio\": 0-0.3, \"reason\": \"one plain sentence\"}. Propose only when macro conditions justify moving the book per the written policy targets.",
        },
        {
          role: "user",
          content: `Book: rToken sleeve ${(rtoken * 100).toFixed(1)}%, hedge sleeve ${(crypto * 100).toFixed(1)}%, targets: rToken ${(book.targetRtokenPct * 100).toFixed(0)}%, hedge ${(book.targetHedgePct * 100).toFixed(0)}%.\nRecent macro events:\n${recent || "(none)"}\nTimestamp: ${new Date(now).toISOString()}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  const body = await res.json();
  const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}");
  if (!parsed.propose) return null;
  return {
    kind: "proposal",
    proposer: "llm",
    action: "shift",
    from: parsed.from,
    to: parsed.to,
    ratio: Math.max(0, Math.min(0.3, Number(parsed.ratio) || 0)),
    reason: String(parsed.reason ?? "").slice(0, 300),
    ts: now,
  };
}
