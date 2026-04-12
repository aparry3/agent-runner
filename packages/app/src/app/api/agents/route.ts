import { NextRequest, NextResponse } from "next/server";
import { getRunner } from "@/lib/runner";

export async function GET() {
  try {
    const runner = await getRunner();
    const agents = await runner.agents.listAgents();
    return NextResponse.json(agents);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const runner = await getRunner();
    const body = await req.json();
    const { id, name, manifest, ...rest } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing required field: id" }, { status: 400 });
    }
    if (!manifest) {
      return NextResponse.json({ error: "Missing required field: manifest" }, { status: 400 });
    }

    // Store the agent with the YAML manifest in metadata
    await runner.agents.putAgent({
      id,
      name: name ?? id,
      systemPrompt: "",
      model: { provider: "openai", name: "gpt-4o" },
      metadata: { manifest, ...rest },
    });

    return NextResponse.json({ id, created: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
