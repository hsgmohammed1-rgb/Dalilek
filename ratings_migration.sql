-- ==========================================
-- Article Ratings System - Database Migration
-- Run this in your Supabase SQL Editor
-- ==========================================

-- 1. Add rating columns to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS avg_rating NUMERIC DEFAULT 0;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS rating_count BIGINT DEFAULT 0;

-- 2. Create ratings table
CREATE TABLE IF NOT EXISTS article_ratings (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(article_id, session_id)
);

-- 3. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_article_ratings_article_id ON article_ratings(article_id);
CREATE INDEX IF NOT EXISTS idx_article_ratings_session_id ON article_ratings(session_id);

-- 4. Trigger function to auto-update articles.avg_rating / articles.rating_count
CREATE OR REPLACE FUNCTION update_article_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE articles SET
      avg_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM article_ratings WHERE article_id = OLD.article_id), 0),
      rating_count = (SELECT COUNT(*) FROM article_ratings WHERE article_id = OLD.article_id)
    WHERE id = OLD.article_id;
    RETURN OLD;
  ELSE
    UPDATE articles SET
      avg_rating = COALESCE((SELECT ROUND(AVG(rating)::numeric, 1) FROM article_ratings WHERE article_id = NEW.article_id), 0),
      rating_count = (SELECT COUNT(*) FROM article_ratings WHERE article_id = NEW.article_id)
    WHERE id = NEW.article_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach trigger
DROP TRIGGER IF EXISTS trg_article_ratings_update ON article_ratings;
CREATE TRIGGER trg_article_ratings_update
AFTER INSERT OR UPDATE OR DELETE ON article_ratings
FOR EACH ROW EXECUTE FUNCTION update_article_rating_stats();

-- 6. Backfill existing articles with initial rating stats
UPDATE articles SET avg_rating = 0, rating_count = 0 WHERE avg_rating IS NULL;
