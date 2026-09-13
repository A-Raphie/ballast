import Link from "next/link";
import { readLedger } from "@/lib/ledger";
import { WatchFloor } from "@/app/components/watch-floor";
import { Panel, StatStrip } from "@/app/components/kit";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const v = await readLedger();
  const live = v.lastTickTs !== null && Date.now() - v.lastTickTs < 20 * 60 * 1000;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Ballast",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    description:
      "A trading agent that moves tokenized US stocks into crypto when bad news hits overnight, with a receipt showing the exact rules behind every decision.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    author: { "@type": "Person", name: "Raphie", url: "https://x.com/a_raphie" },
  };

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* centered fold: eyebrow, h1, one paragraph, CTAs */}
      <section className="mx-auto max-w-3xl px-6 pb-16 pt-24 text-center">
        <div className="micro mb-5">Bitget AI Base Camp Hackathon S2 · Agentic Trading</div>
        <h1 style={{ fontSize: "clamp(2.25rem, 8vw, 3.75rem)" }} className="font-[family-name:var(--font-display)] font-bold leading-[1.05] tracking-tight">
          Wall Street sleeps.
          <br />
          <span className="text-[var(--decision)]">Your portfolio doesn&apos;t have to.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
          Tokenized US stocks trade 24/7, and big news does not wait for the opening bell.
          Ballast is a trading agent that moves your tokenized stocks into crypto when a shock
          lands overnight, and hands you a receipt showing exactly why every trade was allowed.
        </p>
        <p className="mx-auto mt-4 max-w-xl text-sm text-[var(--text-muted)]">
          Practice money. Real prices. Every practice trade labeled as such.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/control-room" className="btn btn-primary whitespace-nowrap">
            Open the control room
          </Link>
          <Link href="/policy" className="btn btn-ghost whitespace-nowrap">
            Read the rules
          </Link>
        </div>
        <div className="mt-6 flex justify-center">
          <StatStrip
            items={[
              { label: "Watching since", value: v.sensingSince ? new Date(v.sensingSince).toISOString().slice(0, 10) : "arming" },
              { label: "Log entries", value: v.events.length },
              { label: "Rules enforced", value: 7 },
              { label: "Rule violations", value: 0, tone: "decision" },
            ]}
          />
        </div>
      </section>

      {/* the framed product object: the live band, exactly as the app renders it */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <Panel className="p-4 md:p-6">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="micro">The night watch band</span>
            <span className={`micro ${live ? "text-[var(--decision)]" : ""}`}>
              {v.lastTickTs
                ? `live snapshot · ${Math.max(0, Math.round((Date.now() - v.lastTickTs) / 60000))} min old`
                : "arming"}
            </span>
          </div>
          <WatchFloor macroEvents={v.macroEvents} decisions={v.decisions} nowTs={Date.now()} />
        </Panel>
        <p className="caption mt-4 text-center">
          This is the real control-room view reading real data. Dots are news stories the agent
          noticed; diamonds are decisions its rules allowed or refused.
        </p>
      </section>

      {/* what it does, in three beats */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="micro mb-6 text-center">How it works</div>
        <div className="grid gap-4 text-center sm:grid-cols-3">
          {[
            ["You write the rules once", "Plain-language rules with real numbers: the target mix, the crypto band, the quiet hours. Save them and the running agent obeys within 15 minutes."],
            ["It watches all night", "News headlines and live prices, checked every 15 minutes on Bitget's public data. When a shock lands, the trade must pass every rule before it exists."],
            ["You read the receipts", "Every decision ships a receipt: what triggered it, each rule with its measured number, the order, and what the portfolio would look like after."],
          ].map(([t, d]) => (
            <div key={t as string} className="card px-5 py-6 text-left">
              <div className="text-sm font-semibold text-[var(--decision)]">{t as string}</div>
              <p className="caption mt-2">{d as string}</p>
            </div>
          ))}
        </div>
      </section>

      {/* what it works with */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="micro mb-6 text-center">What it works with</div>
        <div className="grid gap-4 text-center sm:grid-cols-3">
          {[
            ["Bitget Agent Hub", "The agent's account is authorized through Agent Hub; market data for tokenized stocks and crypto comes from Bitget's stack. Trades are simulated and labeled."],
            ["Public market data", "Tokenized US stocks (think Nvidia or Tesla as tokens) and crypto prices, no API keys needed, checked every 15 minutes."],
            ["The written policy", "Fixed rules, not an AI, decide every trade today. An AI decision slot is wired and waits behind one setting."],
          ].map(([t, d]) => (
            <div key={t as string} className="card px-5 py-6 text-left">
              <div className="text-sm font-semibold">{t as string}</div>
              <p className="caption mt-2">{d as string}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/control-room" className="btn btn-primary">
            Open the control room
          </Link>
        </div>
      </section>
    </main>
  );
}
