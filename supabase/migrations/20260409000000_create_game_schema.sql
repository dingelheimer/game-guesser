-- EPIC 2, Story 2.1: Game Data Pipeline — Create Database Schema
--
-- Tables: games, platforms, genres, game_platforms, game_genres, screenshots, covers, sync_state
-- All tables have RLS enabled with public read and no public write.

-- ---------------------------------------------------------------------------
-- Trigger function: auto-update updated_at
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- games
-- ---------------------------------------------------------------------------

CREATE TABLE games (
  id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  igdb_id               INTEGER UNIQUE NOT NULL,
  name                  TEXT NOT NULL,
  slug                  TEXT,
  first_release_date    DATE NOT NULL,
  release_year          SMALLINT NOT NULL,
  summary               TEXT,
  -- IGDB rating fields
  rating                REAL,
  rating_count          INTEGER DEFAULT 0,
  total_rating          REAL,
  total_rating_count    INTEGER DEFAULT 0,
  -- Engagement signals used for popularity score
  follows               INTEGER DEFAULT 0,
  hypes                 INTEGER DEFAULT 0,
  -- Derived popularity fields (computed by Story 2.4)
  popularity_score      REAL,
  popularity_rank_per_year INTEGER,
  -- IGDB sync tracking
  igdb_updated_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_games_release_year        ON games (release_year);
CREATE INDEX idx_games_popularity          ON games (release_year, popularity_score DESC NULLS LAST);
CREATE INDEX idx_games_igdb_id             ON games (igdb_id);
CREATE INDEX idx_games_popularity_rank     ON games (release_year, popularity_rank_per_year NULLS LAST);

CREATE TRIGGER set_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "games_public_read" ON games
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- platforms
-- ---------------------------------------------------------------------------

CREATE TABLE platforms (
  id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  igdb_id INTEGER UNIQUE NOT NULL,
  name    TEXT NOT NULL
);

ALTER TABLE platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platforms_public_read" ON platforms
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- genres
-- ---------------------------------------------------------------------------

CREATE TABLE genres (
  id      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  igdb_id INTEGER UNIQUE NOT NULL,
  name    TEXT NOT NULL
);

ALTER TABLE genres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "genres_public_read" ON genres
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- game_platforms (many-to-many join)
-- ---------------------------------------------------------------------------

CREATE TABLE game_platforms (
  game_id     BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  platform_id BIGINT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, platform_id)
);

CREATE INDEX idx_game_platforms_platform ON game_platforms (platform_id);

ALTER TABLE game_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_platforms_public_read" ON game_platforms
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- game_genres (many-to-many join)
-- ---------------------------------------------------------------------------

CREATE TABLE game_genres (
  game_id  BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  genre_id BIGINT NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, genre_id)
);

CREATE INDEX idx_game_genres_genre ON game_genres (genre_id);

ALTER TABLE game_genres ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_genres_public_read" ON game_genres
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- covers (one per game)
-- ---------------------------------------------------------------------------

CREATE TABLE covers (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id       BIGINT UNIQUE NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  igdb_image_id TEXT NOT NULL,
  width         INTEGER,
  height        INTEGER
);

CREATE INDEX idx_covers_game ON covers (game_id);

ALTER TABLE covers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "covers_public_read" ON covers
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- screenshots (multiple per game)
-- ---------------------------------------------------------------------------

CREATE TABLE screenshots (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id       BIGINT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  igdb_image_id TEXT NOT NULL,
  width         INTEGER,
  height        INTEGER,
  sort_order    SMALLINT DEFAULT 0,
  curation      TEXT DEFAULT 'uncurated'
                CHECK (curation IN ('curated', 'uncurated', 'rejected'))
);

CREATE INDEX idx_screenshots_game ON screenshots (game_id, curation, sort_order);

ALTER TABLE screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "screenshots_public_read" ON screenshots
  FOR SELECT TO anon, authenticated USING (true);

-- ---------------------------------------------------------------------------
-- sync_state (key-value store for incremental import tracking)
-- ---------------------------------------------------------------------------

CREATE TABLE sync_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;
-- sync_state is internal — no public read; only service role accesses it
