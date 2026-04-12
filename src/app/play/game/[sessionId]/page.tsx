import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Game",
};

/**
 * Placeholder game session page shown after the host starts the multiplayer game.
 */
export default async function GamePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-8">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Game in progress</h1>
        <p className="text-muted-foreground text-sm">Session: {sessionId}</p>
      </div>
    </div>
  );
}
