import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLobbyRoomPageData } from "@/lib/multiplayer/lobbyPage";
import { LobbyScreen } from "./LobbyScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lobby",
};

/**
 * Multiplayer lobby route that loads room membership server-side before hydrating realtime UI.
 */
export default async function LobbyPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const room = await getLobbyRoomPageData(roomId);

  if (room === null) {
    redirect("/play");
  }

  return <LobbyScreen initialRoom={room} />;
}
