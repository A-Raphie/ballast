import { describe, it, expect } from "vitest";
import { symbolName, symbolHint, sleeveName, shiftPhrase, ruleName, clauseReason, verdictWord, kindLabel, proposerName, executionLabel, severityWord, sentence } from "./display";

describe("symbols", () => {
  it("renders the human pair convention (BTC/USDT) on display surfaces", () => {
    expect(symbolName("BTCUSDT")).toBe("BTC/USDT");
    expect(symbolName("ETHUSDT")).toBe("ETH/USDT");
    expect(symbolName("RNVDAUSDT")).toBe("RNVDA/USDT");
    expect(symbolName("SOLUSDT")).toBe("SOL/USDT");
  });
  it("passes through non-pair symbols unchanged", () => {
    expect(symbolName("USDT")).toBe("USDT");
    expect(symbolName("BTCUSD")).toBe("BTCUSD");
  });
  it("symbolHint carries the friendly expansion for tooltips", () => {
    expect(symbolHint("RNVDAUSDT")).toBe("Nvidia as a tokenized US stock");
    expect(symbolHint("BTCUSDT")).toBe("bitcoin, priced in USDT");
    expect(symbolHint("RFOOUSDT")).toBe("RFOO as a tokenized US stock");
  });
});

describe("shiftPhrase", () => {
  it("speaks the six known shifts in plain verbs", () => {
    expect(shiftPhrase("rtoken-sleeve", "usdt-buffer")).toBe("sold tokenized stocks for cash");
    expect(shiftPhrase("rtoken-sleeve", "crypto")).toBe("swapped tokenized stocks for crypto");
    expect(shiftPhrase("usdt-buffer", "crypto")).toBe("bought crypto with spare cash");
    expect(shiftPhrase("usdt-buffer", "rtoken-sleeve")).toBe("bought tokenized stocks with cash");
    expect(shiftPhrase("crypto", "usdt-buffer")).toBe("sold crypto for cash");
    expect(shiftPhrase("crypto", "rtoken-sleeve")).toBe("swapped crypto for tokenized stocks");
  });
  it("composes from sleeve names for unknown pairs", () => {
    expect(shiftPhrase("hedge-sleeve", "usdt-buffer")).toBe("moved crypto into cash");
  });
  it("names sleeves in the ledger vocabulary", () => {
    expect(sleeveName("rtoken-sleeve")).toBe("tokenized stocks");
    expect(sleeveName("usdt-buffer")).toBe("cash");
    expect(sleeveName("crypto")).toBe("crypto");
  });
});

describe("ruleName + clauseReason", () => {
  it("names all seven core rules", () => {
    for (const id of ["B1-drift", "B2-drawdown", "B3-hedge-band", "B4-event", "B5-blackout", "B6-concentration", "B7-stale"]) {
      expect(ruleName(id)).toMatch(/^the .+ rule$/);
      expect(clauseReason(id)).toBeTruthy();
    }
  });
  it("names the library rules", () => {
    expect(ruleName("max-trades-per-day")).toBe("the trade-count rule");
    expect(clauseReason("volatility-halt")).toBe("markets were swinging too hard");
  });
  it("falls back to a humanized id for future rule ids, stripping L-numbers", () => {
    expect(ruleName("something-new")).toBe("the something new rule");
    expect(ruleName("L3-max-trades-per-day")).toBe("the trade-count rule");
    expect(ruleName("L7-custom-cap")).toBe("the custom cap rule");
  });
  it("sentence() capitalizes only the first letter", () => {
    expect(sentence("sold tokenized stocks for cash")).toBe("Sold tokenized stocks for cash");
  });
});

describe("small label maps (capitalized, his capital-letters ask)", () => {
  it("verdicts stay lowercase mid-sentence; labels start capital", () => {
    expect(verdictWord("allow")).toBe("allowed");
    expect(verdictWord("deny")).toBe("denied");
    expect(verdictWord("halt")).toBe("stopped");
    expect(kindLabel("all")).toBe("Everything");
    expect(kindLabel("macro")).toBe("News");
    expect(kindLabel("proposal")).toBe("Trade idea");
    expect(proposerName("threshold-fallback")).toBe("Built-in logic");
    expect(proposerName("llm")).toBe("AI model");
    expect(executionLabel("paper")).toBe("Practice");
    expect(executionLabel("simulated")).toBe("Simulated fill");
    expect(severityWord("high")).toBe("Big story");
    expect(severityWord("medium")).toBe("Notable story");
  });
});
