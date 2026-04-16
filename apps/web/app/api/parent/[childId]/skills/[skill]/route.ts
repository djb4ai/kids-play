import { NextResponse } from "next/server";
import { SKILLS, type Skill } from "@kids-play/shared";
import { getLearningStore } from "@/lib/learning-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ childId: string; skill: string }> }
) {
  const { childId, skill } = await params;
  const parsedSkill = SKILLS.includes(skill as Skill) ? (skill as Skill) : null;

  if (!parsedSkill) {
    return NextResponse.json(
      { error: "Skill was not recognized." },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(getLearningStore().getParentSkillDetail(childId, parsedSkill));
  } catch (error) {
    console.error("[kids-play] parent skill lookup failed", error);

    return NextResponse.json(
      { error: "Skill detail was not available." },
      { status: 404 }
    );
  }
}
