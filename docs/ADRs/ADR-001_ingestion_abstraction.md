# ADR-001 — Ingestion Provider Abstraction
Date: 2025-08-29 • Status: Accepted

Context
Need flexible ingestion for <=1k users, <=25 concurrent, $50/mo during bake-off.

Options
(1) Hard-wire a single provider (2) Multi-provider Port/Adapter + registry (3) External ETL service

Decision
Adopt Port/Adapter per category (news/filings/rss/social) with env-driven registry; stage→normalize→dedupe→publish.

Consequences (+/−)
+ Easy provider swap/add; keeps monolith simple.
− Small upfront abstraction.

Revisit trigger
If concurrency >25 or job parallelism demands a worker tier.