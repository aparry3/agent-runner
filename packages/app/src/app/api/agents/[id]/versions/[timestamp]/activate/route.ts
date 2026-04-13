import { NextRequest, NextResponse } from "next/server";
import { activateVersion, getVersion } from "@/lib/versions";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; timestamp: string }> }
) {
  try {
    const { id, timestamp } = await params;
    const decodedTimestamp = decodeURIComponent(timestamp);

    const agent = await getVersion(id, decodedTimestamp);
    if (!agent) {
      return NextResponse.json(
        { error: `Version not found for agent "${id}" at ${decodedTimestamp}` },
        { status: 404 }
      );
    }

    await activateVersion(id, decodedTimestamp);
    return NextResponse.json({ activated: true, agentId: id, timestamp: decodedTimestamp });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
