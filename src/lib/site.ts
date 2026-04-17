// SPDX-License-Identifier: AGPL-3.0-only
export const siteConfig = {
  name: "Game Guesser",
  url: "https://gameguesser.com",
  description:
    "A video game timeline guessing party game where you place games by release year, chase streaks, and compete with friends.",
  ogImage: "/og.png",
  repoUrl: "https://github.com/dingelheimer/game-guesser",
  privacyUrl: "/privacy",
  kofiUrl: "https://ko-fi.com/garbageapps",
} as const;

export function getSiteUrl(path = "/") {
  return new URL(path, siteConfig.url).toString();
}
