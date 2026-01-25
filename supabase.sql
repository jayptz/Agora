-- AgoraSim Database Schema
-- Run this in your Supabase SQL editor to set up the tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Subreddit Personas Table
-- Stores community profiles that can be updated over time
CREATE TABLE IF NOT EXISTS subreddit_personas (
  subreddit_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tone TEXT NOT NULL,
  norms JSONB NOT NULL DEFAULT '[]'::jsonb,
  failure_triggers JSONB NOT NULL DEFAULT '[]'::jsonb,
  example_phrases JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Simulation Runs Table
-- Stores every simulation for memory and learning
CREATE TABLE IF NOT EXISTS simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  subreddit_id TEXT NOT NULL,
  input_text TEXT NOT NULL,
  score FLOAT8 NOT NULL,
  outcome TEXT NOT NULL,
  confidence TEXT NOT NULL,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  rewrites JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 3. Feedback Table (Optional)
-- Allows users to rate simulation accuracy
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES simulation_runs(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating IN (-1, 1)),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_simulation_runs_subreddit ON simulation_runs(subreddit_id);
CREATE INDEX IF NOT EXISTS idx_simulation_runs_created_at ON simulation_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_run_id ON feedback(run_id);

-- Row Level Security (RLS)
-- Enable RLS on all tables
ALTER TABLE subreddit_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE simulation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow anonymous read access to subreddit_personas
CREATE POLICY "Allow anonymous read on subreddit_personas"
  ON subreddit_personas
  FOR SELECT
  TO anon
  USING (true);

-- Allow authenticated read access to subreddit_personas
CREATE POLICY "Allow authenticated read on subreddit_personas"
  ON subreddit_personas
  FOR SELECT
  TO authenticated
  USING (true);

-- No public write access - writes only through service role in API routes
-- Service role key bypasses RLS automatically

-- Comments
COMMENT ON TABLE subreddit_personas IS 'Stores community profiles that evolve over time';
COMMENT ON TABLE simulation_runs IS 'Memory of all simulations for learning and analytics';
COMMENT ON TABLE feedback IS 'User feedback on simulation accuracy';
