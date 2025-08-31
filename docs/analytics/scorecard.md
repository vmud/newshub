# Provider Scorecard — 24h (NewsHub)

**Use:** `SELECT * FROM provider_scorecard_24h ORDER BY provider;`

**Columns**
- provider — 'perplexity' | 'gdelt' | …
- runs_24h — ingestion runs in last 24h
- last_run_ts — timestamp of most recent run
- items_ingested_24h — total published items (post-dedupe)
- dedupe_avg_pct_24h — avg dedupe % across runs
- errors_24h — provider_error count last 24h
- success_rate_pct_24h — 100 * successful_runs / (successful_runs + errorful_runs)
- last_success_ts — timestamp of last non-empty successful run

**Sanity helpers**
- `SELECT * FROM company_coverage_24h ORDER BY company;`
- `SELECT * FROM snacks_cost_24h;`