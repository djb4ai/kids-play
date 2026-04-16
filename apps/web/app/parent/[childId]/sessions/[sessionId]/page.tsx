import { ParentSessionDetailScreen } from "@/components/parent-shared";

export default async function ParentSessionDetailPage({
  params
}: {
  params: Promise<{ childId: string; sessionId: string }>;
}) {
  const { childId, sessionId } = await params;
  return <ParentSessionDetailScreen childId={childId} sessionId={sessionId} />;
}
