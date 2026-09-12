import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  readPolicyConfig,
  readPolicyLive,
  remotePolicyEnabled,
  validateWrite,
  writePolicyConfig,
  commitPolicyLive,
  bumpVersion,
  setRemotePolicyCache,
} from "@/agent/policy-config";
import { appendEvents } from "@/agent/ledger";
import type { PolicyChangeEvent } from "@/agent/types";

export const dynamic = "force-dynamic";

function summary(changes: Record<string, { from: unknown; to: unknown }>): string {
  return (
    Object.entries(changes)
      .map(([k, v]) => `${k} ${v.from} -> ${v.to}`)
      .join(", ") || "no numeric changes"
  );
}

export async function GET() {
  // live rulebook first (the repo is the source of truth), bundled file as fallback
  const policy = (remotePolicyEnabled() ? await readPolicyLive() : null) ?? (await readPolicyConfig());
  return NextResponse.json(policy);
}

export async function POST(request: Request) {
  let write: unknown;
  try {
    write = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "body must be JSON" }, { status: 400 });
  }

  const current = (remotePolicyEnabled() ? await readPolicyLive() : null) ?? (await readPolicyConfig());
  const result = validateWrite(current, write as never);
  if ("error" in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  const version = bumpVersion(current.version);
  const next = { ...result.next, version };
  const changesSummary = summary(result.changes);
  const message = `rule edit from try-ballast.netlify.app: ${changesSummary} (policy v${version})`;

  if (remotePolicyEnabled()) {
    const commit = await commitPolicyLive(next, message);
    if (!commit.ok) return NextResponse.json({ ok: false, error: commit.error }, { status: 502 });
    setRemotePolicyCache(next);
    revalidatePath("/policy");
    revalidatePath("/");
    return NextResponse.json({
      ok: true,
      version,
      changes: result.changes,
      note: "Committed to the repo. The running agent pulls it before its next tick (within 15 minutes) and the change lands in the ledger.",
    });
  }

  // self-hosted: write the local file the local agent reads, ledger the change here
  await writePolicyConfig(next);
  const event: PolicyChangeEvent = {
    kind: "policy_change",
    version,
    changes: result.changes,
    ts: Date.now(),
  };
  await appendEvents([event]);
  revalidatePath("/policy");
  revalidatePath("/");
  return NextResponse.json({ ok: true, version, changes: result.changes });
}
