import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { parseGenerateGameRequest } from "@kids-play/shared";
import { createGeneratedGameSession, toLaunchMetadata } from "@/lib/generation";
import { getLearningStore } from "@/lib/learning-store";
import { saveGameSession } from "@/lib/session-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Choose Reading, Memory, or Attention to start.",
        retryable: true
      },
      { status: 400 }
    );
  }

  try {
    const generationRequest = parseGenerateGameRequest(body);
    const store = getLearningStore();
    const adaptiveContext = store.getAdaptiveContext(
      generationRequest.childId,
      generationRequest.skill
    );
    const session = await createGeneratedGameSession(
      {
        ...generationRequest,
        difficultyLevel: adaptiveContext.targetDifficultyLevel
      },
      { adaptiveContext }
    );
    saveGameSession(session);

    return NextResponse.json(toLaunchMetadata(session), { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "Choose Reading, Memory, or Attention to start.",
          retryable: true
        },
        { status: 400 }
      );
    }

    console.error("[kids-play] generation failed", error);

    return NextResponse.json(
      {
        error: "We could not start the game yet. Please try again.",
        retryable: true
      },
      { status: 503 }
    );
  }
}
