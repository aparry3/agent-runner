import { NextResponse } from "next/server";
import { requireUserContext, AuthRequiredError } from "@/lib/user";
import { ForbiddenError, requireSuperAdmin } from "@/lib/admin";
import { listSystemAgents } from "@agntz/worker";

export async function GET() {
  try {
    const { userId } = await requireUserContext();
    requireSuperAdmin(userId);

    const agents = await listSystemAgents();
    return NextResponse.json(
      agents.map((a) => ({
        id: a.id,
        name: a.name,
        displayName: a.displayName,
        description: a.description,
        sourcePath: a.sourcePath,
      }))
    );
  } catch (error) {
    return errorResponse(error);
  }
}

function errorResponse(error: unknown) {
  if (error instanceof AuthRequiredError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: String(error) }, { status: 500 });
}
