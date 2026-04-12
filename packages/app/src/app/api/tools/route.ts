import { NextResponse } from "next/server";
import { getRunner } from "@/lib/runner";

export async function GET() {
  try {
    const runner = await getRunner();
    const tools = runner.tools.list();
    return NextResponse.json(tools);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
