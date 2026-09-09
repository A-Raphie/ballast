# Ballast — Design Brief

## Design brief: Ballast
Event: Bitget AI Base Camp Hackathon S2 · Agentic Trading track · Cross-Asset Execution Agent sub-theme
Concept: when a macro shock hits while Wall Street sleeps, Ballast shifts the tokenized-stock book into crypto; every decision carries its clause chain.
Judging: 50% paper-trading quant (Sharpe, max DD, win rate) + 50% judges (decision explainability, agent architecture quality, risk-control effectiveness).

- **Consensus default (banned):** candlestick-dashboard hero, glassmorphic stat bento, right-rail AI chat panel, purple-blue gradients, neon candle soup, emoji icons, "Powered by Bitget" footer. S1's showcased entries already established this shape; judges will have seen it dozens of times.
- **Axes pushed (3):**
  1. **Layout paradigm: the 24h time-canvas.** The organizing surface is the Night Watch Band: one horizontal 24-hour band where closed-market windows are shaded, macro events land as markers, and Ballast's hedge decisions plot as fixes. The page reads as a watch chart, not a dashboard grid and not a document column (both owned by prior portfolio entries and banned here).
  2. **Color strategy: decision-ink scarcity.** Bitget's mined cyan #00E5FF appears ONLY where Ballast acted: a plotted fix, a sealed clause chain, the agent's live status. Market context is rendered in the neutral ladder; macro event markers are lavender-white #F8F7FF. No verdict red/green pairs (recourse/tally own those). The accent's scarcity is the semantics.
  3. **Motion: plot-a-fix choreography.** Motion fires only when a real event lands (market marker, policy verdict, executed fix): the marker drops onto the band, the fix plots, the clause chain draws its check line. Nothing loops, nothing idle-animates (stillness-as-pitch is verger's; this is event-scope, not pitch).
- **Axes kept conventional:** typography (Switzer, Bitget's own body face via Fontshare; display substitutes for their proprietary Pulse at conventional weights: the sponsor-fidelity IS the tie), elevation (hairlines-only, rgba ink), density (instrument-dense in the control room, editorial on the landing).
- **Sponsor synthesis (mined from bitget.com/activity-hub/hackathon computed styles Sep 9, not guessed):** field #070808, panel #151517, ink #F4F5F7, mute #8E8E92, deep-ladder #252629/#57585C, secondary #F8F7FF, decision-ink #00E5FF, decision-deep #03AAC7, hairlines rgba(255,255,255,0.02-0.1). Their display face Pulse is proprietary: substitute Archivo (unused in portfolio) at weight 600-700, tabular numerals everywhere.
- **Signature move: THE NIGHT WATCH BAND.** The 24-hour canvas IS the product's thesis made physical: the US market closes and the band keeps running, which is the whole reason Ballast exists. Macro markers land at real timestamps; Ballast's fixes plot on the same band; clicking a fix opens its clause chain (trigger → policy clauses checked → risk-gate verdicts → order → counterfactual book). Mechanism test: pass (the band shows the product working; it could not sit on any other project). 5-minute test: pass (a component library gives cards, not a live 24h canvas with clause-annotated fixes backed by a real paper log). Demo test: pass (the money moment is a fix plotting live at 02:47). Scarcity: fixes land a few times a day plus scripted gauntlet runs; never on loop.
- **Familiarity anchor (the one kept):** a live positions/exposure strip (book, hedge leg, drawdown) as a quiet header readout. Traders expect a position line; Jakob's law buys the strangeness budget for the band.
- **Supporting instrument (quiet, not the signature):** the heel gauge, a stability dial showing book drawdown as list angle (ballast metaphor), bound to the real log.
- **Avoid-list:** document/ledger layout (rushes/assay/scrip own it), paper receipts + stamp strikes (assay/scrip/reeve), mono-first typography (rushes/tally), terminal instrument (tally), stillness-as-pitch (verger), desaturated verdict pairs (recourse/tally), decision cards as universal unit (purser v3), live-streaming event feed as motion grammar (recourse), light-first fields (lading/verger), serif/engraved display (scrip/verger).
- **Interaction quality bar:** all motion interruptible; markers land with the momentum of the event, never snap-to-center; the clause chain opens as a panel morphing from its fix marker; high-frequency moments (price ticks on the exposure strip) stay motionless.
- **Craft floor:** body 15-25px, line spacing 120-145%, line length 45-90ch, tabular numerals for every number, no color-alone semantics (fixes get glyph + cyan; violations get glyph + ink), spacing scale 4/8-based, HSL shade ladder defined in tokens.
- **Chains to:** semantic-tokens → ui-craft → deterministic-design; landing follows the remlo grammar (centered fold, one framed product object, py-32 rhythm, hairlines) with the Night Watch Band as the framed live object.

## Feel
"Night watch: instrument-calm, scarce-ink, exactly-literal." Tiebreaker: when two designs both work, pick the quieter one and move the chroma to the thing Ballast did.

## Audience
Track judges (trading-literate, 90-second attention budget, allergic to dashboards they've seen 50 times) + tokenized-stock holders who read positions daily. They expect instrument-grade honesty, not marketing glow.

## Design tokens
Defined in `app/globals.css` at build (semantic-tokens skill; zero raw hex outside tokens). Ladder from the mined set: field #070808, panel #151517, ink #F4F5F7, mute #8E8E92, deep #252629/#57585C, context #F8F7FF, decision-ink #00E5FF, decision-deep #03AAC7, hairlines rgba(255,255,255,.02/.06/.1). Type: Switzer (body + display, Fontshare), Archivo reserved for oversized numerals if needed; tabular numerals mandatory. Spacing 4/8 scale; radius 8px family.

## Copy tone
Plain-verb, night-shift terse, zero jargon walls: "Market closed. Ballast is not." Verdicts stated as facts with their clause: "Denied: drawdown guard 2 (measured 3.1%, limit 2.5%)." No exclamation marks, no "powered by", no "revolutionary".

## User flow (build order)
1. **Landing (front door)** — one-liner hero, the Night Watch Band as the framed live object (real ledger data), enter path: "Open the control room". Proves the product in seconds.
2. **Control room** — the band full-width; exposure strip anchored on top (book, hedge leg, heel, drawdown); fix markers clickable.
3. **Clause chain panel** — morphs from the clicked fix: trigger, clauses with measured vs limit, gate verdict, order, counterfactual book. The explainability money shot.
4. **Policy** — the written policy, human-readable, each clause showing its id + current parameters + lifetime verdict count.
5. **Log** — raw ledger browse with filters (macro/market/verdict/order/fill); the audit surface for judges who want the ugly truth.

## Folds used
- (empty on scaffold — appended per built screen per ui-craft)
