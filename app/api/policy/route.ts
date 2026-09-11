import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { readPolicyConfig, validateWrite, writePolicyConfig, bumpVersion } from "@/agent/policy-config";
import { appendEvents } from "@/agent/ledger";
import type { PolicyChangeEvent } from "@/agent/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const policy = await readPolicyConfig();
  return NextResponse.json(policy);
}

export async function POST(request: Request) {
  // The public deploy holds no pen: function storage is ephemeral and the
  // agent's policy file lives in its repo. Rule changes ship through the repo
  // (edit policy.json -> agent obeys next tick -> deploy publishes the new
  // rulebook). Self-hosted instances accept writes.
  if (process.env.NETLIFY) {
    return NextResponse.json(
      { ok: false, error: "read-only on the public deploy: the agent holds the pen. Rule changes ship through its repo." },
      { status: 405 },
    );
  }
  let write: unknown;
  try {
    write = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "body must be JSON" }, { status: 400 });
  }
  const current = await readPolicyConfig();
  const result = validateWrite(current, write as never);
  if ("error" in result) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }
  const version = bumpVersion(current.version);
  const next = { ...result.next, version };
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
