-- Phase 2 Migration: Perception + Calibration
-- Add subreddit_examples table and calibration columns to subreddit_personas

-- 1. Create subreddit_examples table (agent observations)
CREATE TABLE IF NOT EXISTS subreddit_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  subreddit_id TEXT NOT NULL,
  text TEXT NOT NULL,
  label TEXT DEFAULT 'neutral' CHECK (label IN ('good_fit', 'bad_fit', 'neutral')),
  source TEXT DEFAULT 'manual'
);

-- 2. Add calibration columns to subreddit_personas
ALTER TABLE subreddit_personas
  ADD COLUMN IF NOT EXISTS weights JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS thresholds JSONB DEFAULT '{}'::jsonb;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_subreddit_examples_subreddit ON subreddit_examples(subreddit_id);
CREATE INDEX IF NOT EXISTS idx_subreddit_examples_created_at ON subreddit_examples(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subreddit_examples_label ON subreddit_examples(label);

-- Enable RLS on subreddit_examples
ALTER TABLE subreddit_examples ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subreddit_examples
-- Allow anonymous read access (for viewing examples)
CREATE POLICY "Allow anonymous read on subreddit_examples"
  ON subreddit_examples
  FOR SELECT
  TO anon
  USING (true);

-- Allow authenticated read access
CREATE POLICY "Allow authenticated read on subreddit_examples"
  ON subreddit_examples
  FOR SELECT
  TO authenticated
  USING (true);

-- No public write access - writes only through service role in API routes
-- Service role key bypasses RLS automatically

-- Comments
COMMENT ON TABLE subreddit_examples IS 'Agent observations: community examples used for persona training';
COMMENT ON COLUMN subreddit_personas.weights IS 'Learned scoring weights (salesyPenaltyWeight, vaguenessPenaltyWeight, etc.)';
COMMENT ON COLUMN subreddit_personas.thresholds IS 'Learned score-to-outcome thresholds';
