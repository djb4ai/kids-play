import { NextResponse } from "next/server";
import { getLearningStore } from "@/lib/learning-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ childId: string; sessionId: string }> }
) {
  const { childId, sessionId } = await params;

  try {
    const detail = getLearningStore().getParentSessionDetail(childId, sessionId);
    if (!detail) {
      return NextResponse.json(
        { error: "Session detail was not available." },
        { status: 404 }
      );
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error("[kids-play] parent session detail lookup failed", error);

    return NextResponse.json(
      { error: "Session detail was not available." },
      { status: 404 }
    );
  }
}
