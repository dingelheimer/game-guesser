import { describe, expect, it } from "vitest";
import { getDisplayName } from "../../../supabase/functions/solo-turn/logic/platform-names";

describe("getDisplayName", () => {
  it("maps well-known IGDB verbose names to short display names", () => {
    expect(getDisplayName("PC (Microsoft Windows)")).toBe("PC");
    expect(getDisplayName("PlayStation 4")).toBe("PS4");
    expect(getDisplayName("PlayStation 5")).toBe("PS5");
    expect(getDisplayName("Nintendo Entertainment System")).toBe("NES");
    expect(getDisplayName("Super Nintendo Entertainment System")).toBe("SNES");
    expect(getDisplayName("Nintendo Switch")).toBe("Switch");
    expect(getDisplayName("Xbox Series X|S")).toBe("Xbox Series X/S");
  });

  it("maps PlayStation legacy platforms", () => {
    expect(getDisplayName("PlayStation")).toBe("PS1");
    expect(getDisplayName("PlayStation 2")).toBe("PS2");
    expect(getDisplayName("PlayStation 3")).toBe("PS3");
    expect(getDisplayName("PlayStation Portable")).toBe("PSP");
    expect(getDisplayName("PlayStation Vita")).toBe("PS Vita");
  });

  it("maps Nintendo handheld platforms", () => {
    expect(getDisplayName("Game Boy")).toBe("Game Boy");
    expect(getDisplayName("Game Boy Color")).toBe("GBC");
    expect(getDisplayName("Game Boy Advance")).toBe("GBA");
    expect(getDisplayName("Nintendo DS")).toBe("DS");
    expect(getDisplayName("Nintendo 3DS")).toBe("3DS");
  });

  it("maps Sega platforms", () => {
    expect(getDisplayName("Sega Mega Drive/Genesis")).toBe("Sega Genesis");
    expect(getDisplayName("Sega Saturn")).toBe("Saturn");
    expect(getDisplayName("Dreamcast")).toBe("Dreamcast");
  });

  it("falls back to the original IGDB name for unmapped platforms", () => {
    expect(getDisplayName("FM Towns")).toBe("FM Towns");
    expect(getDisplayName("Sharp X68000")).toBe("Sharp X68000");
    expect(getDisplayName("Some Unknown Platform")).toBe("Some Unknown Platform");
  });

  it("returns empty string unchanged for empty input", () => {
    expect(getDisplayName("")).toBe("");
  });
});
