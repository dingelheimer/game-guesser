/**
 * Maps verbose IGDB platform names to shorter display names.
 * Unknown platform names fall back to the original IGDB name.
 */

const DISPLAY_NAMES: Record<string, string> = {
  // PC / Misc
  "PC (Microsoft Windows)": "PC",
  Mac: "Mac",
  Linux: "Linux",
  "Web browser": "Browser",
  // PlayStation
  PlayStation: "PS1",
  "PlayStation 2": "PS2",
  "PlayStation 3": "PS3",
  "PlayStation 4": "PS4",
  "PlayStation 5": "PS5",
  "PlayStation Portable": "PSP",
  "PlayStation Vita": "PS Vita",
  // Xbox
  Xbox: "Xbox",
  "Xbox 360": "Xbox 360",
  "Xbox One": "Xbox One",
  "Xbox Series X|S": "Xbox Series X/S",
  // Nintendo — home
  "Nintendo Entertainment System": "NES",
  "Super Nintendo Entertainment System": "SNES",
  "Nintendo 64": "N64",
  GameCube: "GameCube",
  Wii: "Wii",
  "Wii U": "Wii U",
  "Nintendo Switch": "Switch",
  // Nintendo — handheld
  "Game Boy": "Game Boy",
  "Game Boy Color": "GBC",
  "Game Boy Advance": "GBA",
  "Nintendo DS": "DS",
  "Nintendo 3DS": "3DS",
  "Virtual Boy": "Virtual Boy",
  // Sega
  "Sega Master System/Mark III": "Sega Master System",
  "Sega Mega Drive/Genesis": "Sega Genesis",
  "Sega 32X": "Sega 32X",
  "Sega CD": "Sega CD",
  "Sega Saturn": "Saturn",
  Dreamcast: "Dreamcast",
  "Sega Game Gear": "Game Gear",
  // Atari
  "Atari 2600": "Atari 2600",
  "Atari 5200": "Atari 5200",
  "Atari 7800": "Atari 7800",
  "Atari Jaguar": "Jaguar",
  "Atari Lynx": "Lynx",
  // Mobile / Other
  iOS: "iOS",
  Android: "Android",
  "Windows Phone": "Windows Phone",
};

export function getDisplayName(igdbName: string): string {
  return DISPLAY_NAMES[igdbName] ?? igdbName;
}
