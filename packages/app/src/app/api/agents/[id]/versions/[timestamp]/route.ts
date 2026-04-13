import { NextRequest, NextResponse } from "next/server";
import { getVersion } from "@/lib/versions";

export async function GET(
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

    return NextResponse.json(agent);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
