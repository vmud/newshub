# NewsHub — Product Charter (v0.1)

*Date:* 2025-08-29 • *Owner:* Vaughn • *Stack:* Vercel + Supabase • *Scale:* ≤1k users (≤25 concurrent)

## One-liner

NewsHub gives our team a 60-second, personality-packed brief of the most relevant company news—auto-ingested, AI-summarized in *Snacks* style, and ready to click—so nobody wastes 20 minutes spelunking five sites.

## Problem

Leads burn time finding credible, relevant updates across sources; dashboards are slow, dry, or scattershot. Teams miss context and walk into client talks under-prepped.

## Users & JTBD

Client services, strategy, and leadership who need: "Summarize what matters for my brands now, let me skim in one place, and jump to the source fast."

## Value Proposition & Differentiation

- *Snacks* tone (exactly 3 bullets; clear "why it matters")
- Ruthless curation per company (aliases roll-up: e.g., **Snapdragon→Qualcomm**, **Android/Pixel→Google**)
- Provenance badges + deep links; tri-daily freshness
- Demo-first delivery: every slice ships a preview URL

## Constraints (deliberate)

- ≤1,000 total users; ≤25 concurrent
- $50/mo API budget during bake-offs
- Low/no-cost stack (Vercel + Supabase)
- Coding via Cursor/Claude Code; UI via Subframe
- Latest stable, widely used libs only

## North Star Metric (NSM)

**Daily Brief Completion Rate** = (signed-in users who load FrontPage **and** click ≥1 item) / (signed-in DAUs), measured daily.

## Driver Metrics

1. FrontPage p95 time-to-first-render ≤ **2.0s**
2. Ingestion freshness: News ≤ **12h** at each run; Filings ≤ **2h**
3. Client-News CTR ≥ **30%**
4. Snacks usefulness ≥ **80%** owner quick-score (audit n≥50; **0** hallucinations)

## MVP Narrative (R1 scope)

FrontPage shows Top-10 stories for **Qualcomm/Snapdragon**, **Google/Android/Pixel**, **Samsung**, **Whirlpool**, **Best Buy** with provider badges + relative time. Top-3 render in *Snacks*; the rest show raw snippets. Admin can **Ingest now**. Tri-daily cron (7a/12p/5p ET). CompanyHub shows latest news + filings per brand. All instrumented.

## MoSCoW (R1)

**Must:** Perplexity+GDELT ingestion; dedupe; FrontPage Top-10; *Snacks* Top-3; alias map; SEC filings list; telemetry; preview deploys  
**Should:** 7am Top-10 pre-summaries; witty empty/error states; simple search (Postgres FTS)  
**Could:** RSS adapter (1–3 feeds); CompanyHub filters; Subframe theming  
**Won't (R1):** realtime sockets; email digests; collaboration; mobile app; public API; vector DB; complex ranking

## Key Decisions (current)

- **Data:** Supabase Postgres; monolith Next.js (App Router)
- **Ingestion:** Port/Adapter + registry (Perplexity, GDELT) with stage→normalize→dedupe→publish
- **Summaries:** Top-3 now; Top-10 at **7am** (Pass-2); noon/5pm = on-click (lazy)
- **Voice:** *Snacks* style with buzzword-linter gate
- **Observability:** Vercel logs + Sentry; minimal OTel

## One-way doors

- Supabase as primary store
- Provider-agnostic ingestion contract
- Event names/telemetry schema
- Security posture (minimal PII; RLS where needed)

## Two-way doors

FrontPage filters; search sophistication; ranking tweaks; social trending; RSS set; email digests.

## Risks & Mitigations

- **Coverage/freshness gaps:** provider scorecard + registry swap
- **Style drift/hallucinations:** Snacks gates + linter + audit
- **Cost creep:** per-provider caps; lazy summaries at noon/5p
- **Licensing:** provenance + respect TOS; fallback to metadata/links
- **Flaky UX:** demo-first cadence; "cached from last run" fallback

## Why it matters

Saves ~15–20 min/day/person and raises credibility in client conversations with consistent, on-brand intel.
