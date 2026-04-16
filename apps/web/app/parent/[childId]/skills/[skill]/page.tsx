import { ParentSkillDetailScreen } from "@/components/parent-shared";

export default async function ParentSkillDetailPage({
  params
}: {
  params: Promise<{ childId: string; skill: string }>;
}) {
  const { childId, skill } = await params;
  return <ParentSkillDetailScreen childId={childId} skill={skill} />;
}
