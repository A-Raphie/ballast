import { NextResponse } from "next/server";
import { readLedger } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export async function GET() {
  const v = await readLedger();
  return NextResponse.json({
    lastTickTs: v.lastTickTs,
    bookValue: v.bookValue,
    exposure: v.exposure,
    heelPct: v.heelPct,
    policyVersion: v.policyVersion,
    market: v.marketSnapshot.map((m) => ({ symbol: m.symbol, px: m.px, chg24h: m.chg24h })),
    decisions: v.decisions.slice(0, 10).map((d) => ({
      id: d.id,
      ts: d.ts,
      result: d.verdict?.result ?? null,
      from: d.proposal?.from ?? null,
      to: d.proposal?.to ?? null,
      execution: d.order?.execution ?? null,
    })),
  });
}
