import { NextRequest, NextResponse } from "next/server";
import { workerRun } from "@/lib/worker-client";
import { requireUserContext, AuthRequiredError } from "@/lib/user";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireUserContext();
    const body = await req.json();
    const { agentId, input, sessionId } = body;

    if (!agentId) {
      return NextResponse.json({ error: "Missing required field: agentId" }, { status: 400 });
    }

    const result = await workerRun({ userId, agentId, input, sessionId });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
