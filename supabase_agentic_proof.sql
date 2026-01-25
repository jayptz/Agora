-- Agentic Proof Migration
-- Add columns to support before/after training proof and memory tracking

-- Add last_signals to subreddit_personas (stores training signals)
ALTER TABLE subreddit_personas
  ADD COLUMN IF NOT EXISTS last_signals JSONB DEFAULT '{}'::jsonb;

-- Ensure updated_at exists
ALTER TABLE subreddit_personas
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add training_version to simulation_runs (optional, for before/after comparison)
ALTER TABLE simulation_runs
  ADD COLUMN IF NOT EXISTS training_version TEXT;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_simulation_runs_training_version ON simulation_runs(training_version);
