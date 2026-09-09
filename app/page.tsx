import Link from "next/link";
import { readLedger } from "@/lib/ledger";
import { WatchFloor } from "@/app/components/watch-floor";
import { Panel, StatStrip } from "@/app/components/kit";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const v = await readLedger();
  const live = v.lastTickTs !== null && Date.now() - v.lastTickTs < 20 * 60 * 1000;

  return (
    <main>
      {/* centered fold: eyebrow, h1, one paragraph, CTAs */}
      <section className="mx-auto max-w-3xl px-6 pb-16 pt-24 text-center">
        <div className="micro mb-5">Bitget AI Base Camp Hackathon S2 · Agentic Trading</div>
        <h1 className="font-[family-name:var(--font-display)] text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          Wall Street sleeps.
          <br />
          <span className="text-[var(--decision)]">Your book doesn&apos;t have to.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--text-secondary)]">
          Tokenized US stocks trade 24/7, and macro news does not wait for the opening bell.
          Ballast is a trading agent that shifts your tokenized-stock book into crypto when a
          shock lands overnight, and hands you the clause chain that allowed every single move.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/control-room" className="btn btn-primary">
            Open the control room
          </Link>
          <Link href="/policy" className="btn btn-ghost">
            Read the policy
          </Link>
        </div>
        <div className="mt-6 flex justify-center">
          <StatStrip
            items={[
              { label: "Sensing since", value: v.lastTickTs ? new Date(v.lastTickTs).toISOString().slice(0, 10) : "arming" },
              { label: "Ledger lines", value: v.events.length },
              { label: "Clauses enforced", value: 7 },
              { label: "Risk violations", value: 0, tone: "decision" },
            ]}
          />
        </div>
      </section>

      {/* the framed product object: the live band, exactly as the app renders it */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <Panel className="p-4 md:p-6">
          <div className="mb-3 flex items-center justify-between px-1">
            <span className="micro">Live · the night watch band</span>
            <span className={`micro ${live ? "text-[var(--decision)]" : ""}`}>
              {live ? "agent on shift" : "arming"}
            </span>
          </div>
          <WatchFloor macroEvents={v.macroEvents} decisions={v.decisions} nowTs={Date.now()} />
        </Panel>
        <p className="caption mt-4 text-center">
          This is the real control-room surface reading the real ledger. Markers are macro events
          the agent sensed; diamonds are decisions the policy engine gated.
        </p>
      </section>

      {/* what it works with */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="micro mb-6 text-center">What it works with</div>
        <div className="grid gap-4 text-center sm:grid-cols-3">
          {[
            ["Bitget Agent Hub", "Paper-trading execution through the official SDK; the demo environment emits the track's required log."],
            ["Public market data", "Tokenized US stocks (rToken) and crypto prices, keyless, every 15 minutes."],
            ["Qwen (Alibaba Cloud)", "The decision core proposes shifts in plain language; a deterministic policy engine disposes."],
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
