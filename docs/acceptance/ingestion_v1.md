# Ingestion v1 — Visual Acceptance Card (NewsHub)

## Goal you’ll click

From the FrontPage, you (owner) can press **“Ingest now”** and see fresh Top‑10 articles for the five brands within the same session. Tri‑daily crons (7a/12p/5p ET) run the same pipeline automatically.

## Scope (this slice only)

* Providers: **Perplexity** + **GDELT** (news).
* Brands: Qualcomm/Snapdragon, Google/Android/Pixel, Samsung, Whirlpool, Best Buy (aliases roll up to canonical names).
* Outputs: Published `articles` with `provider` badges and correct `source_domain`, **no placeholders**.
* Snacks: **Top‑3 only** (existing behavior). Pass‑2 will handle Top‑10 @ 7am.

## Preconditions (env & infra)

* `.env.local` and Vercel have values for:
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PPLX_API_KEY`, `EDGAR_USER_AGENT`, optional `SENTRY_DSN`.
* Supabase tables exist with RLS: `companies`, `articles`, `summaries`, `events_frontpage`, `ingestion_runs`.
* Feature flags: `snacks_top3_on=true`, `frontpage_filters=false`.

## Provider registry & contracts

* **Registry (env/manifest)**: `NEWS_PROVIDERS=perplexity,gdelt`.
* **Port**: `news.fetch(company_aliases[], since_dt) -> ProviderArticle[]`
* **ProviderArticle**: `{ title, url, source_domain, published_at, company_slug, provider, raw_json }`
* Adapters must return clean `url` (absolute, https) and valid ISO `published_at`.

## Pipeline (idempotent)

1. **Fetch** from each enabled provider per brand (alias map).
2. **Normalize**: lower‑case host, strip UTM, coerce dates, compute `url_norm`.
3. **Company match**: title contains alias (whole‑word) **or** host in official domain allowlist.
4. **Priority**: official domains > tier‑1 outlets > others (simple weights).
5. **Dedupe**: upsert on unique `url_norm`; compute `content_sig = hash(title + source_domain + day(published_at))` for sanity.
6. **Publish** into `articles`; record run in `ingestion_runs`.
7. **Skip bad rows** (missing `title` or invalid `url`) and log `article_skipped_invalid_url`.

## Data contracts (DB)

* `articles(id uuid, company_id, title text, url text, url_norm text unique, source_domain text, published_at timestamptz, priority int, provider text, created_at timestamptz)`
* Indexes: `unique(url_norm)`, `idx_articles_company`, `idx_articles_published_at`
* `ingestion_runs(id uuid, provider text, item_count int, dedupe_rate numeric, scheduled boolean, ts timestamptz)`
* **RLS**: anon read on `articles`/`summaries`; writes require service role.

## Admin & Cron

* **Admin “Ingest now”** endpoint executes the full pipeline and returns `{provider_counts, dedupe_rate, last_run_ts}`; FrontPage revalidates and reflects new items.
* **Cron (Vercel, UTC)**: `0 11 * * *`, `0 16 * * *`, `0 21 * * *` (== 7a/12p/5p ET). Calls the same endpoint with `scheduled=true`.

## Telemetry (must emit)

* `ingest_run { provider, item_count, dedupe_rate, scheduled }`
* `provider_error { provider, type: timeout|rate_limit|schema|network }`
* `article_skipped_invalid_url { provider, reason }`
* FrontPage continues to emit: `frontpage_viewed`, `headline_clicked`, `summary_generated`, `snacks_lint_failed`.

## Budget guardrails

* Per run: `NEWS_MAX_LINKS_PER_PROVIDER_PER_RUN` (default 25), `PPLX_MAX_REQUESTS_PER_RUN` (default 8).
* Daily: `SUMMARY_MAX_PER_DAY` caps Top‑3 demo work; Top‑10 @ 7am comes in Pass‑2.
* On cap hit: stop gracefully; emit `budget_cap_hit { provider }`.

## Error taxonomy & resilience

* Retries: exponential backoff, max 2.
* Circuit breaker: disable provider for 15 min after N consecutive failures; show **“cached from last run”** banner on FrontPage.
* Store `raw_json` in staging for debug; never render from staging.

## Owner demo checklist (acceptance)

1. Click **Ingest now** → Top‑10 updates; each item has a visible **headline**, correct **source domain**, and **provider badge**; dedupe ≤ **15%**.
2. Cron tab shows 3 successful runs per day (UTC schedule) with non‑zero `item_count`.
3. No `example.com` links; items with bad/missing URLs do **not** render and are logged.
4. Each of the five brands appears with at least one recent item (if upstream provides).
5. Telemetry visible in DB/logs for `ingest_run` and any `provider_error`.
6. Snacks Top‑3 still works; no changes to acceptance for Snacks.

## Success gates (pass/fail)

* Coverage: manual spot‑check ≥ **90%** of “must‑see” links found across 7 days.
* Precision: ≥ **80%** on‑topic (n=50 audit).
* Freshness: ≥ **90%** of items ≤ **12h** old at each run.
* Dedupe: ≤ **15%** per run.
* Cost: ≤ **\$35** of the \$50 cap used by news in week‑1.

## Non‑goals (explicit)

* Social trending, complex ranking, filters, email digests, and Top‑10 pre‑summaries at noon/5p (those are later slices).

## Rollback

* One toggle to disable a failing provider; continue serving **cached** articles.
* Revert to last known good deployment if FrontPage fails to render Top‑10.

## Observability

* Sentry capture on provider exceptions + ingest route failures.
* Lightweight **scorecard view**: counts by provider, dedupe%, last run timestamp.

## MCP checklists (agent)

* **Supabase MCP**: ensure schema/indexes; RLS; seed 5 brands; insert 6–9 sample articles only if needed for empty states.
* **Vercel MCP**: upsert env vars; ensure cron entries; return latest Preview URL.

## Deliverables

* **Preview URL** with live ingestion.
* Short report: per‑provider item counts, dedupe%, last‑run timestamps, and any errors.
* 90–120s screencast of the acceptance steps.
