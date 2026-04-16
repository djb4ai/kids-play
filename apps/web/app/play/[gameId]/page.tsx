import { PlayShell } from "../../../components/play-shell";

export default async function PlayPage({
  params
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const runtimeOrigin = process.env.GAME_RUNTIME_ORIGIN ?? "http://127.0.0.1:3001";

  return <PlayShell gameId={gameId} runtimeOrigin={runtimeOrigin} />;
}
