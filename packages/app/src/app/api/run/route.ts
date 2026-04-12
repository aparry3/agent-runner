import { NextRequest, NextResponse } from "next/server";
import { workerRun } from "@/lib/worker-client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentId, input, sessionId } = body;

    if (!agentId) {
      return NextResponse.json({ error: "Missing required field: agentId" }, { status: 400 });
    }

    const result = await workerRun({ agentId, input, sessionId });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
