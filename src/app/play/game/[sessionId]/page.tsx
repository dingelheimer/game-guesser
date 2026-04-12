import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMultiplayerGamePageData } from "@/lib/multiplayer/gamePage";
import { GameScreen } from "./GameScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Game",
};

/**
 * Multiplayer game route that server-loads the active session before hydrating realtime UI.
 */
export default async function GamePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const game = await getMultiplayerGamePageData(sessionId);

  if (game === null) {
    redirect("/play");
  }

  return <GameScreen initialGame={game} />;
}
