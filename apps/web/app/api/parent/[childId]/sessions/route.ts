import { NextResponse } from "next/server";
import { getLearningStore } from "@/lib/learning-store";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ childId: string }> }
) {
  const { childId } = await params;
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  if (typeof limit === "number" && (!Number.isInteger(limit) || limit < 1)) {
    return NextResponse.json(
      { error: "Limit must be a positive integer." },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(getLearningStore().getParentSessions(childId, limit));
  } catch (error) {
    console.error("[kids-play] parent sessions lookup failed", error);

    return NextResponse.json(
      { error: "Session history was not available." },
      { status: 404 }
    );
  }
}
