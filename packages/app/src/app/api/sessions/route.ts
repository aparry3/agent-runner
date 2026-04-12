import { NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/runner";

export async function GET(req: NextRequest) {
  try {
    const runner = await getRunner();
    const agentId = req.nextUrl.searchParams.get("agentId") ?? undefined;
    const sessions = await runner.sessions.listSessions(agentId);
    return NextResponse.json(sessions);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
