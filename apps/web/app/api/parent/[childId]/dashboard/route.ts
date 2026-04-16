import { NextResponse } from "next/server";
import { getLearningStore } from "@/lib/learning-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ childId: string }> }
) {
  const { childId } = await params;

  try {
    return NextResponse.json(getLearningStore().getParentDashboard(childId));
  } catch (error) {
    console.error("[kids-play] parent dashboard lookup failed", error);

    return NextResponse.json(
      { error: "Parent dashboard was not available." },
      { status: 404 }
    );
  }
}
