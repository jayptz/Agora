# Agora (MVP) — YC Hackathon Project

Agora is an MVP that simulates **Reddit community reactions** to a draft post before you publish.  
You provide a post (title + body) and pick a subreddit archetype, and the system runs a lightweight **multi-agent thread simulation** to estimate likely outcomes: engagement, sentiment, common objections, and “will this get downvoted or removed” risk.

> Goal: help founders and growth teams **pressure-test messaging** against community norms before posting.

---

## What this MVP does

### Input
- Subreddit selection (or custom “community profile”)
- Draft post: title + body
- Optional: target persona (founder, marketer, engineer), constraints (tone, length)

### Output
- Simulated comment thread (top comments + replies)
- Predicted vote trajectory (rough)
- Sentiment distribution and controversy score
- Likely moderation risks and rewrite suggestions
- Recommended title + hook variants

---

## Why Reddit-first
Reddit is community-structured, norm-driven, and thread-based. That makes it easier to model:
- Visibility dynamics (early votes + time decay)
- Subreddit-specific norms (what gets punished vs rewarded)
- Thread trees (argument evolution over replies)

---

## MVP Architecture

### High level flow
1. **Community Profile Loader**
   - Loads a subreddit-style profile (rules, norms, taboo topics, tone preferences)
2. **Agent Generator**
   - Creates a small set of agents (8–30) with personas aligned to that community
3. **Simulation Engine**
   - Runs an event loop: post → visibility → comments/votes → replies
4. **Scoring + Summaries**
   - Produces metrics, flags risks, and suggests edits

### Components
- `api/simulate` builds agents + runs simulation
- `sim/` contains agent logic + thread propagation
- `ui/` shows results: comments tree, scores, suggestions

---

## Agent Loop: Observe → Reason → Act → Remember

AgoraSim now operates as an **agentic system** with persistent memory:

### 1. **Observe**
- Loads community personas from Supabase (if configured) or falls back to static data
- Optional: Ingests real Reddit data via official API (when `REDDIT_INGEST_ENABLED=true`)
- Tracks all simulation runs in persistent storage

### 2. **Reason**
- Analyzes draft posts against community norms, tone, and failure triggers
- Calculates scores using rule-based algorithms (salesy penalties, vagueness detection, norm matching)
- Generates rewrite suggestions using OpenAI (with heuristic fallback)

### 3. **Act**
- Returns predictions: outcome (Removed/Ignored/Discussed/Upvoted), confidence, score, reasons, and rewrites
- Provides actionable feedback to improve post quality

### 4. **Remember**
- **Every simulation is saved** to `simulation_runs` table for learning and analytics
- Personas can be updated over time based on Reddit data ingestion
- Feedback loop allows users to rate simulation accuracy

### Memory Architecture

- **Supabase-backed persistence**: All runs stored for future learning
- **Graceful degradation**: Works perfectly without Supabase (uses static personas)
- **Admin tools**: Seed personas, update based on real Reddit data
- **Feature flags**: Reddit ingestion disabled by default, can be enabled when needed

---

## Phase 2: Perception + Calibration

Phase 2 implements **Observe → Reason → Act → Remember** without requiring Reddit API access. The agent learns from manually seeded community examples and recalibrates its internal policy.

### How It Works

1. **Observe**: Manual example ingestion via `POST /api/admin/add-examples`
   - Examples stored in `subreddit_examples` table
   - Labels: `good_fit`, `bad_fit`, or `neutral`
   - No Reddit API calls required

2. **Reason**: Signal derivation from examples (deterministic)
   - Top phrases (bigrams, stopword-filtered)
   - Promo rate (CTA/sales language frequency)
   - Specificity rate (numbers, tools, concrete artifacts)
   - First-person rate ("I", "we", "my", "our")

3. **Act**: Persona recalibration via `POST /api/admin/rebuild-persona`
   - Generates updated norms (4-6 templated rules)
   - Generates failure triggers (3-5 anti-patterns)
   - Computes policy weights (salesyPenaltyWeight, vaguenessPenaltyWeight, etc.)
   - Computes outcome thresholds (Removed/Ignored/Discussed/Upvoted boundaries)

4. **Remember**: Persistent memory in Supabase
   - Trained personas stored with `weights` and `thresholds` columns
   - `/api/simulate` automatically uses trained parameters if available
   - Falls back to static scoring if no training data exists

### Database Schema

Run `supabase_phase2_migration.sql` in your Supabase SQL editor:

**New Table: `subreddit_examples`**
- Stores agent observations (manual seed)
- RLS enabled (read-only for public, writes via service role)

**Updated Table: `subreddit_personas`**
- `weights` (jsonb) - Learned scoring weights
- `thresholds` (jsonb) - Learned score-to-outcome thresholds

### Admin Endpoints

**POST `/api/admin/add-examples`**
- Header: `x-admin-secret: <ADMIN_SECRET>`
- Body: `{ subredditId: string, examples: string[], label?: "good_fit"|"bad_fit"|"neutral" }`
- Validates: 1-100 examples, each 5-2000 chars
- Returns: `{ ok: true, inserted: number }`

**POST `/api/admin/rebuild-persona`**
- Header: `x-admin-secret: <ADMIN_SECRET>`
- Body: `{ subredditId: string }`
- Loads last 300 examples, computes signals, updates persona
- Returns: `{ ok: true, signals: {...} }`

### Simulation Update

`POST /api/simulate` now:
- Loads persona from Supabase (with weights/thresholds if trained)
- Applies trained policy parameters to scoring
- Falls back to static behavior if Supabase unavailable
- Never crashes on Supabase failures (graceful degradation)

### Constraints

- ✅ No Reddit API calls
- ✅ No web scraping  
- ✅ Deterministic training (no LLM required)
- ✅ Service role key never exposed to client
- ✅ Supabase failures don't crash simulate endpoint

---

## Agentic Proof Features

The agent demonstrates learning through observable proof points:

### 1. **Before vs After Training Proof**

**POST `/api/admin/proof-run`**
- Runs simulation BEFORE training, then rebuilds persona, then runs AFTER
- Returns side-by-side comparison with diff:
  - `outcomeChanged`: Did the outcome change?
  - `scoreDelta`: Score difference
  - `reasonsAdded`/`reasonsRemoved`: How reasoning changed
- Stores both runs in `simulation_runs` with `training_version="before"` and `"after"`

### 2. **Agent Rationale**

Every simulation includes `agentRationale` - a deterministic 1-2 sentence explanation:
- Compares draft signals (promo/specificity/firstPerson) to community norms
- References trained policy weights/thresholds when available
- Explains why the outcome was predicted

Example: *"This community is sensitive to promotional language and rewards specific context, but your draft lacks concrete details, so it's likely to be ignored."*

### 3. **Memory Indicators**

Simulation responses include `memory` metadata:
- `examplesObserved`: Number of examples used to train persona
- `lastTrainedAt`: Timestamp of last persona rebuild

Also in `personaSnapshot`:
- `signalsFromTraining`: Promo/specificity/firstPerson rates from training data
- `topPhrases`: Learned phrases from community examples
- `weights`/`thresholds`: Calibrated policy parameters

### 4. **Bad-Fit Training**

Script: `scripts/seed_bad_fit.js`
- Seeds 8 bad-fit examples per subreddit (startups, technology, sideproject)
- Examples are realistic promo/CTA/hype posts
- Helps agent learn what NOT to do

### Database Schema Updates

Run `supabase_agentic_proof.sql` in your Supabase SQL editor to add required columns:

```sql
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
```

**Note:** The code handles missing columns gracefully, so the app will work even if these migrations haven't been run yet. However, for full agentic proof features, run the migration.

---

## Tech Stack

- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **Backend:** Next.js API routes
- **LLM:** OpenAI (optional, for rewrite generation)
- **Storage:** Supabase (PostgreSQL) with RLS policies
- **Reddit API:** Official Reddit API (optional, feature-flagged)

---

## Repo Structure

```txt
agora-mvp/
  app/                     # Next.js UI
    page.tsx
    components/
  pages/api/
    simulate.ts            # API endpoint
  sim/
    communityProfiles.ts   # subreddit profiles
    agentFactory.ts        # creates agents/personas
    engine.ts              # simulation loop
    scoring.ts             # metrics + risk scoring
    prompts.ts             # prompt templates
  lib/
    openai.ts
  .env.example
  README.md
