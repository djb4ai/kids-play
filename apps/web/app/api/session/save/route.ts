import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { parseSaveSessionRequest } from "@kids-play/shared";
import { getLearningStore } from "@/lib/learning-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Session data could not be saved.", retryable: true },
      { status: 400 }
    );
  }

  try {
    const payload = parseSaveSessionRequest(body);
    const result = await getLearningStore().saveCompletedSession(payload);

    return NextResponse.json(
      {
        saved: true,
        sessionId: result.sessionId,
        recommendation: result.recommendation
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Session data was incomplete.", retryable: true },
        { status: 400 }
      );
    }

    console.error("[kids-play] session save failed", error);

    return NextResponse.json(
      { error: "Session data could not be saved.", retryable: true },
      { status: 503 }
    );
  }
}
