import { NextRequest, NextResponse } from "next/server";
import { workerRunStream } from "@/lib/worker-client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentId, input, sessionId } = body;

    if (!agentId) {
      return NextResponse.json({ error: "Missing required field: agentId" }, { status: 400 });
    }

    const stream = await workerRunStream({ agentId, input, sessionId });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
