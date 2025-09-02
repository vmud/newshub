# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev          # Start development server (Next.js)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# TypeScript
npx tsc --noEmit    # Type-check without emitting files
```

## Architecture Overview

NewsHub is a news aggregation platform built with Next.js App Router, focused on delivering curated news summaries ("Snacks") for tracked companies. The system follows an agentic, visual-first approach optimized for small-scale deployment on Vercel + Supabase.

### Key Components

**Frontend**: Next.js App Router with React 19, styled with Tailwind CSS. Main entry at `app/page.tsx` renders `FrontPage` component showing top 10 articles with provider badges and relative timestamps.

**Data Pipeline**: 
- Ingestion runs 3x daily (7am/12pm/5pm ET) via Vercel cron
- Providers: Perplexity API and GDELT for news, SEC EDGAR for filings (registry-based in `config/newshub.manifest.yaml`)
- Pipeline at `lib/ingestion/pipeline.ts` handles deduplication and storage

**Database**: Supabase Postgres with views for provider health, company coverage, and costs. Articles stored with embeddings for semantic search.

**AI Processing**: "Snacks" summaries generated for top 3 articles using AI Gateway pattern (`lib/ai-gateway.ts`). Style enforced via `style/snacks_style_guide.md` - conversational journalism with 3 bullets max, 200 chars each.

### Project Constraints

- Scale: ≤1k users, ≤25 concurrent
- Budget: $50/month API costs
- Delivery: 48-hour demo cycles with Vercel preview URLs
- UI: Prefer existing components over custom (Subframe when needed)
- Scope: FrontPage v0 currently - resist feature creep

### Key Files

- `config/newshub.manifest.yaml`: System configuration, feature flags, provider registry
- `docs/acceptance/visual_frontpage_v0.md`: Current acceptance criteria
- `docs/system_prompt.md`: North Star product philosophy
- `.cursorrules`: Context loading directives

### Development Workflow

1. Always check acceptance criteria before implementing features
2. Verify TypeScript compilation before considering work complete
3. Track telemetry events: frontpage_viewed, headline_clicked, ingest_run, summary_generated
4. Maintain "Snacks" quality gates: no buzzwords, contractions present, why-it-matters in bullet 3

### Current State

Working on FrontPage v0 with Perplexity + GDELT providers. Admin scorecard available at `/admin/scorecard`. TypeScript has 3 known errors in experimental AI SDK features that don't affect runtime.