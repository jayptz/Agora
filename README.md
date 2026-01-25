# Agora (MVP) — Reddit Agent Simulation for Post Performance Testing

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

## Tech Stack (suggested MVP)
You can swap pieces easily. This repo ships with a simple default:

- **Frontend:** Next.js + TypeScript + Tailwind
- **Backend:** Next.js API routes (or Express)
- **LLM:** OpenAI (used only for comment generation + rewrite suggestions)
- **Storage (optional):** Supabase (saving runs) or SQLite
- **Embeddings (optional):** for similarity / topic matching

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
