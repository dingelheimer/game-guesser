-- EPIC 12, Story 12.1: Settings Schema & Platform Families
--
-- Adds a family grouping column to the platforms table and populates it
-- with a static mapping of known IGDB platform IDs to families.

ALTER TABLE platforms
  ADD COLUMN family TEXT NOT NULL DEFAULT 'other';

-- Static mapping of well-known IGDB platform IDs to platform families.
-- IDs sourced from https://api.igdb.com/v4/platforms
-- Families: nintendo, playstation, xbox, pc, sega, atari, mobile, other
UPDATE platforms SET family = 'nintendo'    WHERE igdb_id IN (
  -- NES / Famicom
  18,
  -- Super Nintendo / Super Famicom
  19,
  -- Nintendo 64
  4,
  -- GameCube
  21,
  -- Wii
  5,
  -- Wii U
  41,
  -- Nintendo Switch
  130,
  -- Game Boy
  33,
  -- Game Boy Color
  22,
  -- Game Boy Advance
  24,
  -- Nintendo DS
  20,
  -- Nintendo 3DS
  37,
  -- Virtual Boy
  87
);

UPDATE platforms SET family = 'playstation' WHERE igdb_id IN (
  -- PlayStation
  7,
  -- PlayStation 2
  8,
  -- PlayStation 3
  9,
  -- PlayStation 4
  48,
  -- PlayStation 5
  167,
  -- PlayStation Portable
  38,
  -- PlayStation Vita
  46,
  -- PS Now / PS Plus (streaming)
  129
);

UPDATE platforms SET family = 'xbox'        WHERE igdb_id IN (
  -- Xbox (original)
  11,
  -- Xbox 360
  12,
  -- Xbox One
  49,
  -- Xbox Series X|S
  169
);

UPDATE platforms SET family = 'pc'          WHERE igdb_id IN (
  -- PC (Microsoft Windows)
  6,
  -- Mac
  14,
  -- Linux
  3,
  -- DOS
  13,
  -- Browser / Web
  82,
  -- Stadia
  170
);

UPDATE platforms SET family = 'sega'        WHERE igdb_id IN (
  -- Mega Drive / Genesis
  29,
  -- SEGA Master System
  64,
  -- Game Gear
  35,
  -- Saturn
  32,
  -- Dreamcast
  23,
  -- SEGA 32X
  30,
  -- SEGA CD / Mega-CD
  78
);

UPDATE platforms SET family = 'atari'       WHERE igdb_id IN (
  -- Atari 2600
  59,
  -- Atari ST
  63,
  -- Atari 5200
  66,
  -- Atari 7800
  60,
  -- Atari Jaguar
  62,
  -- Atari Lynx
  61
);

UPDATE platforms SET family = 'mobile'      WHERE igdb_id IN (
  -- Android
  34,
  -- iOS
  39,
  -- Windows Phone
  73
);

-- Index for efficient console-lock filtering in build_deck.
CREATE INDEX idx_platforms_family ON platforms (family);
