import { describe, it, expect } from "vitest";
import { symbolName, sleeveName, shiftPhrase, ruleName, clauseReason, verdictWord, kindLabel, proposerName, executionLabel, severityWord } from "./display";

describe("symbolName", () => {
  it("maps every watchlist rToken and crypto symbol", () => {
    expect(symbolName("RNVDAUSDT")).toBe("tokenized Nvidia");
    expect(symbolName("RTSLAUSDT")).toBe("tokenized Tesla");
    expect(symbolName("RAAPLUSDT")).toBe("tokenized Apple");
    expect(symbolName("RMSFTUSDT")).toBe("tokenized Microsoft");
    expect(symbolName("RSPYUSDT")).toBe("tokenized S&P 500 fund");
    expect(symbolName("RQQQUSDT")).toBe("tokenized Nasdaq fund");
    expect(symbolName("BTCUSDT")).toBe("bitcoin");
    expect(symbolName("ETHUSDT")).toBe("ethereum");
  });
  it("falls back to a readable name for unknown tokens", () => {
    expect(symbolName("RFOOUSDT")).toBe("RFOO (token)");
    expect(symbolName("SOLUSDT")).toBe("SOL (token)");
    expect(symbolName("XYZ")).toBe("XYZ");
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
  it("falls back to a humanized id for future rule ids", () => {
    expect(ruleName("something-new")).toBe("the something new rule");
  });
});

describe("small label maps", () => {
  it("verdicts, kinds, proposers, executions, severity", () => {
    expect(verdictWord("allow")).toBe("allowed");
    expect(verdictWord("deny")).toBe("denied");
    expect(verdictWord("halt")).toBe("stopped");
    expect(kindLabel("macro")).toBe("news");
    expect(kindLabel("proposal")).toBe("trade idea");
    expect(proposerName("threshold-fallback")).toBe("built-in logic");
    expect(proposerName("llm")).toBe("AI model");
    expect(executionLabel("paper")).toBe("practice");
    expect(executionLabel("simulated")).toBe("simulated fill");
    expect(severityWord("high")).toBe("big story");
    expect(severityWord("medium")).toBe("notable story");
  });
});
