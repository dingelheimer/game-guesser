import type { MultiplayerGamePageData } from "@/lib/multiplayer/gamePage";

/**
 * Shared multiplayer game fixture used by GameScreen tests.
 */
export const initialGameFixture: MultiplayerGamePageData = {
  currentTurn: {
    activePlayerId: "11111111-1111-4111-8111-111111111111",
    card: {
      gameId: 900,
      screenshotImageId: "shot-900",
      coverImageId: null,
      title: "?",
      releaseYear: null,
      platform: "",
      isRevealed: false,
    },
    phase: "placing",
    phaseDeadline: "2099-04-12T12:00:00.000Z",
    platformOptions: [],
  },
  currentUserId: "11111111-1111-4111-8111-111111111111",
  players: [
    {
      userId: "11111111-1111-4111-8111-111111111111",
      displayName: "Alex Host",
      joinedAt: "2026-04-11T22:00:00.000Z",
      role: "host",
      score: 0,
      tokens: 2,
      turnPosition: 0,
      timeline: [
        {
          gameId: 10,
          coverImageId: "cover-10",
          title: "Half-Life",
          releaseYear: 1998,
          platform: "PC",
          isRevealed: true,
          screenshotImageId: null,
        },
      ],
    },
    {
      userId: "22222222-2222-4222-8222-222222222222",
      displayName: "Sam Player",
      joinedAt: "2026-04-11T22:01:00.000Z",
      role: "player",
      score: 0,
      tokens: 2,
      turnPosition: 1,
      timeline: [
        {
          gameId: 20,
          coverImageId: "cover-20",
          title: "Portal",
          releaseYear: 2007,
          platform: "PC",
          isRevealed: true,
          screenshotImageId: null,
        },
      ],
    },
  ],
  roomId: "33333333-3333-4333-8333-333333333333",
  sessionId: "44444444-4444-4444-8444-444444444444",
  settings: {
    difficulty: "easy",
    turnTimer: "60",
    tokensEnabled: true,
    startingTokens: 2,
    winCondition: 7,
    gameMode: "competitive",
    variant: "standard",
    genreLockId: null,
    consoleLockFamily: null,
    decadeStart: null,
    speedRound: false,
  },
  status: "active",
  turnNumber: 1,
  teamScore: null,
  teamTimeline: null,
  teamTokens: null,
  winner: null,
};
