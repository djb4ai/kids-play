import { NextResponse } from "next/server";
import { getGameSession } from "@/lib/session-store";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;
  const session = getGameSession(gameId);

  if (!session) {
    return NextResponse.json(
      { error: "Game not found." },
      { status: 404, headers: corsHeaders }
    );
  }

  return NextResponse.json(session, { headers: corsHeaders });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
