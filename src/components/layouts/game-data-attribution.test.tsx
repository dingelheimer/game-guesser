import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameDataAttribution } from "./game-data-attribution";

describe("GameDataAttribution", () => {
  it("renders IGDB and Twitch links with safe external-link attributes", () => {
    render(<GameDataAttribution />);

    const igdbLink = screen.getByRole("link", { name: "IGDB" });
    const twitchLink = screen.getByRole("link", { name: "Twitch" });

    expect(screen.getByText(/game data provided by/i)).toBeInTheDocument();
    expect(igdbLink).toHaveAttribute("href", "https://www.igdb.com");
    expect(igdbLink).toHaveAttribute("target", "_blank");
    expect(igdbLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(twitchLink).toHaveAttribute("href", "https://www.twitch.tv");
    expect(twitchLink).toHaveAttribute("target", "_blank");
    expect(twitchLink).toHaveAttribute("rel", "noopener noreferrer");
  });
});
