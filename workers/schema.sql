-- Ad Vault D1 Database Schema
-- Run with: wrangler d1 execute ad-vault-db --file=./workers/schema.sql

-- Ads table
CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  video_src TEXT NOT NULL,
  source TEXT NOT NULL,
  creator TEXT,
  product TEXT,
  vertical TEXT,
  type TEXT,
  hook_text_overlay TEXT,
  hook_spoken TEXT,
  full_transcript TEXT,
  why_summary TEXT,
  why_key_lesson TEXT,
  tags TEXT, -- JSON array
  date_added TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ad tactics (one-to-many with ads)
CREATE TABLE IF NOT EXISTS ad_tactics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);

-- Ad shots (one-to-many with ads)
CREATE TABLE IF NOT EXISTS ad_shots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ad_id TEXT NOT NULL,
  shot_number INTEGER NOT NULL,
  start_time REAL,
  end_time REAL,
  timestamp TEXT,
  type TEXT DEFAULT 'video',
  thumbnail TEXT,
  description TEXT,
  transcript TEXT,
  text_overlay TEXT,
  purpose TEXT,
  FOREIGN KEY (ad_id) REFERENCES ads(id) ON DELETE CASCADE
);

-- Images table (Image Vault)
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  image_src TEXT NOT NULL,
  source TEXT,
  creator TEXT,
  prompt TEXT, -- JSON or raw text
  raw_prompt TEXT,
  tags TEXT, -- JSON array
  date_added TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tweets table (Tweet Vault)
CREATE TABLE IF NOT EXISTS tweets (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  tags TEXT, -- JSON array
  added_at TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ads_date ON ads(date_added);
CREATE INDEX IF NOT EXISTS idx_ads_creator ON ads(creator);
CREATE INDEX IF NOT EXISTS idx_ad_shots_ad_id ON ad_shots(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_tactics_ad_id ON ad_tactics(ad_id);
CREATE INDEX IF NOT EXISTS idx_images_date ON images(date_added);
CREATE INDEX IF NOT EXISTS idx_tweets_date ON tweets(added_at);
