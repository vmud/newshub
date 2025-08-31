# NewsHub — Roadmap (v0.1)

*Principle:* Every release ends with a **browser demo** tied to NSM/Driver metrics. RICE is directional.

## R1 — FrontPage v0 (Weeks 1–2)

**Goal:** Ship the 48-hour demo and stabilize tri-daily ingestion.

### Epics & Stories

1) **Ingestion baseline (Perplexity+GDELT)**
   - Admin “Ingest now”; stage→normalize→dedupe→publish; provider badges
   - Telemetry: `ingest_run`, `provider_error`, `dedupe_rate`
2) **FrontPage Top-10**
   - Titles, source domain, time-ago, badges; witty empty/error; open in new tab
   - Telemetry: `frontpage_viewed`, `headline_clicked`
3) **Snacks Top-3 + Linter**
   - Exactly 3 bullets (≤200 chars), opener contrast, bullet #3 = why-it-matters
   - Buzzword-linter fallback to raw snippet on fail
   - Telemetry: `summary_generated`, `snacks_lint_failed`
4) **Company Aliases + Filings (SEC)**
   - Alias map for sub-brands; basic filings list per CompanyHub
   - Freshness target ≤ 2h
5) **Cron + Preview Cadence**
   - News at **7a/12p/5p ET** (UTC: 11:00/16:00/21:00)
   - Weekly Mon/Wed/Fri demo rhythm

### Success criteria (R1 exit)

- NSM baseline measured; FrontPage p95 ≤ 2.0s
- News freshness ≤ 12h at each run
- 0 hallucinations in Top-3 (audit n=30)
- Dedupe ≤ 15%; preview URL + screencast delivered

### RICE (R1 candidates)

| Item                       | Reach | Impact | Confidence | Effort | RICE |
|---------------------------|------:|------:|-----------:|------:|-----:|
| Ingestion baseline        | 50    | 3     | 0.9        | 2     | 67.5 |
| FrontPage Top-10          | 50    | 3     | 0.8        | 2     | 60.0 |
| Snacks Top-3 + Linter     | 50    | 2     | 0.8        | 1.5   | 53.3 |
| Filings basic             | 30    | 2     | 0.7        | 1.5   | 28.0 |
| Cron + telemetry hardening| 50    | 1     | 0.9        | 1     | 45.0 |

---

## R2 — Quality & Depth (Weeks 3–4)

**Goal:** Graduate *Snacks* to Top-10 @ **7am**; add search; pilot RSS.

### Scope

- *Snacks* Pass-2: pre-summarize **Top-10 at 7am**; noon/5p lazy
- Postgres FTS search (title/source/bullets)
- RSS adapter (1–3 feeds) with badges
- Error analytics via Sentry; graceful cache fallback everywhere

### Success criteria (R2 exit)

- 0 hallucinations in n≥50 audit; p95 summary latency < 2s; avg cost ≤ $0.20/summary
- Client-News CTR ≥ 30%
- "Useful at a glance" ≥ 80% (owner quick-score)

### RICE (R2 candidates)

| Item                   | Reach | Impact | Confidence | Effort | RICE |
|-----------------------|------:|------:|-----------:|------:|-----:|
| Snacks Top-10 @ 7am   | 60    | 3     | 0.8        | 2     | 72.0 |
| FTS search            | 40    | 2     | 0.8        | 1.5   | 42.7 |
| RSS adapter (1–3)     | 30    | 2     | 0.7        | 1     | 42.0 |
| Sentry + cache harden | 50    | 1     | 0.9        | 1     | 45.0 |

---

## R3 — Experiments & Fit (Weeks 5–6)

**Goal:** Validate UX tweaks & optional signals—only if they move NSM.

### Candidates (behind flags/A/B)

- FrontPage company filter chips
- Social trending (YouTube/Reddit) module
- Ranking tweaks (keyword boosts per brand)
- CompanyHub polish (filings filters, date ranges)

### Graduation rules

Feature graduates only if: **adoption ≥ 25%**, **time-to-first-click ↓ ≥ 20%**, **CTR not down**, and no p95 perf regressions.

---

## Dependencies & Risks

- **Providers:** Perplexity/GDELT uptime & TOS (mitigate via registry/killswitch)
- **Costs:** cap requests; lazy summaries noon/5p; alert at **$40** of $50 budget
- **Legal:** display within fair-use/terms; always deep-link to source

## Demo cadence & governance

- **Mon:** lock demo goal • **Wed:** preview link + risks • **Fri:** show-don't-tell demo  
- Mid-sprint changes default to **next release** unless owner override (logged via ADR)
- Every material choice gets an ADR; Decision Log updated

## Open Questions

1) First RSS feeds to whitelist?  
2) Any brand-safe disclaimers on cards?  
3) Subframe theme tokens (colors/typography) to lock in?

## Next 48 hours

- **Owner:** confirm any must-have RSS feeds; (optional) brand/theme tokens  
- **Dev (agent):** ship R1 slice per *FrontPage v0 — Visual Acceptance Card*; post preview URL & screencast; log telemetry
