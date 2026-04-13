import { NextRequest, NextResponse } from "next/server";
import { listVersions } from "@/lib/versions";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const versions = await listVersions(id);
    return NextResponse.json(versions);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
