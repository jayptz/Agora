-- Phase 2 Migration: Perception + Calibration
-- Run this in your Supabase SQL editor

create extension if not exists "pgcrypto";

create table if not exists public.subreddit_examples (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  subreddit_id text not null,
  text text not null,
  label text not null default 'neutral',
  source text not null default 'manual'
);

alter table public.subreddit_examples enable row level security;

-- Add calibration columns to subreddit_personas if they don't exist
alter table public.subreddit_personas
  add column if not exists weights jsonb default '{}'::jsonb,
  add column if not exists thresholds jsonb default '{}'::jsonb;

-- Indexes for performance
create index if not exists idx_subreddit_examples_subreddit on public.subreddit_examples(subreddit_id);
create index if not exists idx_subreddit_examples_created_at on public.subreddit_examples(created_at desc);

-- RLS Policies (read-only for public, writes via service role)
-- Service role key bypasses RLS automatically, so no write policies needed
