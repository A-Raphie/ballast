import { describe, it, expect } from "vitest";
import { evaluate } from "./policy";
import { readPolicyConfig } from "./policy-config";
import type { BookState, MacroEvent, ProposalEvent, MarketEvent } from "./types";

const T0 = Date.parse("2026-09-13T03:47:00Z"); // outside blackouts, US market closed

function book(over: Partial<BookState> = {}): BookState {
  return {
    usdt: 5000,
    positions: { RNVDAUSDT: { qty: 2.9, market: "rtoken" }, BTCUSDT: { qty: 0.01, market: "crypto" } },
    targetRtokenPct: 0.65,
    targetHedgePct: 0.25,
    openValue24h: 6500, // book worth ~6433.6: 1.02% drawdown, inside B2's 2.5%
    updatedAt: T0,
    ...over,
  };
}

function ctx(over: Record<string, unknown> = {}) {
  const pxOf = new Map([
    ["RNVDAUSDT", 223.72],
    ["BTCUSDT", 78478],
  ]);
  return {
    now: T0,
    book: book(),
    pxOf,
    recentMacro: [macro()],
    dataAgeMs: 0,
    ...over,
  } as Parameters<typeof evaluate>[0];
}

function macro(): MacroEvent {
  return { kind: "macro", source: "federal-reserve", headline: "Fed cuts rates by 50 basis points", severity: "medium", assetsAffected: ["*"], ts: T0 - 3600_000 };
}

const shift: ProposalEvent = { kind: "proposal", proposer: "threshold-fallback", action: "shift", from: "rtoken-sleeve", to: "crypto", ratio: 0.2, reason: "test", ts: T0 };

describe("policy engine", () => {
  it("allows a drift-correcting shift with a fresh qualifying macro event", async () => {
    const v = await evaluate(ctx(), shift, "p1");
    expect(v.result).toBe("allow");
    expect(v.clauses.every((c) => c.pass === true)).toBe(true);
  });

  it("halts when no macro event qualifies (B4 unmeasurable)", async () => {
    const v = await evaluate(ctx({ recentMacro: [] }), shift, "p2");
    expect(v.clauses.find((c) => c.id === "B4-event")?.pass).toBeNull();
    expect(v.result).toBe("halt");
  });

  it("halts on stale market data (B7) even with a qualifying event", async () => {
    const v = await evaluate(ctx({ dataAgeMs: 11 * 60 * 1000 }), shift, "p3");
    expect(v.clauses.find((c) => c.id === "B7-stale")?.pass).toBe(false);
    expect(v.result).toBe("deny");
  });

  it("denies risk-increasing action in drawdown (B2)", async () => {
    const b = book({ openValue24h: 20000 }); // book now worth far less than day-open
    const v = await evaluate(ctx({ book: b }), shift, "p4");
    expect(v.clauses.find((c) => c.id === "B2-drawdown")?.pass).toBe(false);
    expect(v.result).toBe("deny");
  });

  it("denies shifts inside the open blackout (B5)", async () => {
    const t = Date.parse("2026-09-14T14:45:00Z");
    const v = await evaluate(ctx({ now: t }), { ...shift, ts: t }, "p5");
    expect(v.clauses.find((c) => c.id === "B5-blackout")?.pass).toBe(false);
    expect(v.result).toBe("deny");
  });

  it("denies hedge shifts that break the band (B3)", async () => {
    const b = book({ positions: { BTCUSDT: { qty: 0.05, market: "crypto" } } }); // hedge ~83%
    const v = await evaluate(ctx({ book: b }), shift, "p6");
    expect(v.clauses.find((c) => c.id === "B3-hedge-band")?.pass).toBe(false);
    expect(v.result).toBe("deny");
  });

  it("never fabricates prices: unpriced positions shrink sleeves, not pass gates", async () => {
    const pxOf = new Map([["RNVDAUSDT", 223.72]]); // BTC unpriced this tick
    const v = await evaluate(ctx({ pxOf }), shift, "p7");
    // with crypto unmeasurable the verdict must not be a clean allow
    expect(["halt", "deny"]).toContain(v.result);
  });
});

describe("policy knobs", () => {
  it("obeys an edited drift threshold from policy.json", async () => {
    const cfg = await readPolicyConfig();
    const loose = JSON.parse(JSON.stringify(cfg));
    loose.knobs.driftPp = 0.8; // 80pp: current ~55pp drift no longer triggers B1
    const v = await evaluate(ctx(), shift, "p8", loose);
    expect(v.clauses.find((c) => c.id === "B1-drift")?.pass).toBeNull();
  });
  it("carries the policy version into the verdict", async () => {
    const cfg = await readPolicyConfig();
    const v = await evaluate(ctx(), shift, "p9", cfg);
    expect(v.policyVersion).toBe(cfg.version);
  });
});

describe("B6 post-shift concentration", () => {
  it("blocks a buy that would push the largest position past the cap", async () => {
    // BTC at 784.8 of 2433.6 (32%); a 30% cash buy pushes BTC to ~40% > 35% cap
    const small = book({ usdt: 1000, openValue24h: 2450 });
    const pxOf = new Map([["RNVDAUSDT", 223.72], ["BTCUSDT", 78478]]);
    const v = await evaluate({ now: T0, book: small, pxOf, recentMacro: [macro()], dataAgeMs: 0 }, shift, "pb1");
    const b6 = v.clauses.find((c) => c.id === "B6-concentration");
    expect(b6?.pass).toBe(false);
    expect(v.result).toBe("deny");
  });
  it("allows a trim of the over-cap position (risk-reducing)", async () => {
    const big = book({
      usdt: 1000,
      positions: { RNVDAUSDT: { qty: 17.4, market: "rtoken" } },
      openValue24h: 4900,
    });
    const pxOf = new Map([["RNVDAUSDT", 223.72]]);
    const trim = { ...shift, from: "rtoken-sleeve", to: "usdt-buffer", ratio: 0.6 }; // sized past the cap boundary: RNVDA 79.6% -> ~31.8%
    const v = await evaluate({ now: T0, book: big, pxOf, recentMacro: [macro()], dataAgeMs: 0 }, trim, "pb2");
    expect(v.result).toBe("allow");
  });
});

