import { ParentSessionsScreen } from "@/components/parent-shared";

export default async function ParentSessionsPage({
  params
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  return <ParentSessionsScreen childId={childId} />;
}
