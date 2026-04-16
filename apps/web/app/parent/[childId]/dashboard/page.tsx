import { ParentDashboardScreen } from "@/components/parent-shared";

export default async function ParentDashboardPage({
  params
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = await params;
  return <ParentDashboardScreen childId={childId} />;
}
