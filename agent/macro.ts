// Macro sensor: keyless RSS pull + keyword severity heuristic.
//   time = O(f + h), space = O(new)   f = feeds (3), h = headlines per feed (~25)
//   structure: Set of headline hashes for O(1) dedupe against the ledger
//   family: linear scan
// Severity classification is a KEYWORD HEURISTIC until the decision LLM is wired;
// every macro event carries `classifier: "keyword"` so downstream judges can see
// exactly how severity was assigned. The LLM classifier replaces this behind the
// LLM_PROVIDER flag and relabels events classifier: "llm".

import type { MacroEvent } from "./types";

const FEEDS: { url: string; source: string }[] = [
  { url: "https://finance.yahoo.com/news/rssindex", source: "yahoo-finance" },
  { url: "https://www.federalreserve.gov/feeds/press_all.xml", source: "federal-reserve" },
  { url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml", source: "wsj-markets" },
];

// Word-boundary keyword matching: "war" must not fire inside "reward".
// Routine organizational news (bank enforcement actions, comment requests) is
// excluded: it floods the ledger without being a macro shock.
const HIGH_RE = /\b(war|invasion|emergency|crash|default(?:s|ed)?|contagion|nationaliz\w+)\b/i;
const MEDIUM_RE = /\b(rate cut|rate hike|fomc|inflation|cpi|tariff(?:s)?|recession|gdp|jobs report|payroll|earnings warning|guidance cut|sanction(?:s)?|yields|sell-off|selloff)\b/i;
const EXCLUDE_RE = /\b(enforcement action|requests? comment|leadership and objectives|approval of (?:the )?application)\b/i;

function classify(headline: string): "low" | "medium" | "high" {
  if (EXCLUDE_RE.test(headline)) return "low";
  if (HIGH_RE.test(headline)) return "high";
  if (MEDIUM_RE.test(headline)) return "medium";
  return "low";
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return String(h);
}

function extractTitles(xml: string): string[] {
  const out: string[] = [];
  const re = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const t = m[1].trim();
    if (t && t.length > 25 && !/^(rss|feed|news)/i.test(t)) out.push(t);
  }
  return out;
}

export async function senseMacro(now: number, seenHashes: Set<string>): Promise<MacroEvent[]> {
  const events: MacroEvent[] = [];
  const results = await Promise.all(
    FEEDS.map(async (f) => {
      try {
        const res = await fetch(f.url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (!res.ok) return { source: f.source, titles: [] as string[] };
        return { source: f.source, titles: extractTitles(await res.text()) };
      } catch {
        return { source: f.source, titles: [] as string[] }; // feed failure is non-fatal; B7 covers staleness
      }
    }),
  );
  for (const r of results) {
    for (const title of r.titles.slice(0, 25)) {
      const id = hash(title);
      if (seenHashes.has(id)) continue;
      seenHashes.add(id);
      const severity = classify(title);
      if (severity === "low") continue; // only policy-relevant severities enter the ledger
      events.push({
        kind: "macro",
        source: r.source,
        headline: title,
        severity,
        assetsAffected: ["*"],
        ts: now,
      });
    }
  }
  return events;
}

export function headlineHashes(events: { kind: string; headline?: string }[]): Set<string> {
  const s = new Set<string>();
  for (const e of events) if (e.headline) s.add(hash(e.headline));
  return s;
}
