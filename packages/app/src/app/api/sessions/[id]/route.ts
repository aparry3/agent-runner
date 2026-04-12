import { NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/runner";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const runner = await getRunner();
    const messages = await runner.sessions.getMessages(id);
    return NextResponse.json({ sessionId: id, messages });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const runner = await getRunner();
    await runner.sessions.deleteSession(id);
    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
