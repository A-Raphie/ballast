import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { readAgentState, writeAgentState } from "@/agent/agent-state";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await readAgentState());
}

export async function POST(request: Request) {
  // Same pen rule as /api/policy: the public deploy mirrors the agent, it does
  // not command it. Self-hosted instances control their own agent.
  if (process.env.NETLIFY) {
    return NextResponse.json(
      { ok: false, error: "read-only on the public deploy: the agent runs on its own host." },
      { status: 405 },
    );
  }
  let body: { paused?: boolean; note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "body must be JSON" }, { status: 400 });
  }
  if (typeof body.paused !== "boolean") {
    return NextResponse.json({ ok: false, error: "paused must be true or false" }, { status: 400 });
  }
  await writeAgentState(body.paused, body.note ?? (body.paused ? "paused from the control room" : "resumed from the control room"));
  revalidatePath("/control-room");
  return NextResponse.json({ ok: true, paused: body.paused });
}
