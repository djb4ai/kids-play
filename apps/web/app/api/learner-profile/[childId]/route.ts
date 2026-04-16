import { NextResponse } from "next/server";
import { getLearningStore } from "@/lib/learning-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ childId: string }> }
) {
  const { childId } = await params;

  try {
    return NextResponse.json(getLearningStore().getDebugSnapshot(childId));
  } catch (error) {
    console.error("[kids-play] learner profile lookup failed", error);

    return NextResponse.json(
      { error: "Learner profile was not available." },
      { status: 500 }
    );
  }
}
