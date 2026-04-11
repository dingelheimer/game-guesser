-- Migration: create profiles table
-- Epic 8 — Authentication & Leaderboard

CREATE TABLE profiles (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username   TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (needed for leaderboard username display)
CREATE POLICY "Profiles are publicly readable"
    ON profiles FOR SELECT
    USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can create own profile"
    ON profiles FOR INSERT
    WITH CHECK (id = (SELECT auth.uid()));

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

CREATE INDEX idx_profiles_username ON profiles (username);
