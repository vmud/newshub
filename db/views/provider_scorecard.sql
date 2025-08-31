-- 24h provider health snapshot
create or replace view provider_scorecard_24h as
with runs as (
  select
    provider,
    ts,
    item_count,
    coalesce(dedupe_rate, 0) as dedupe_rate,
    (coalesce(item_count,0) > 0) as success
  from ingestion_runs
  where ts >= now() - interval '24 hours'
),
errs as (
  select provider, count(*) as errors_24h
  from events_frontpage
  where event = 'provider_error'
    and (payload->>'provider') is not null
    and ts >= now() - interval '24 hours'
  group by provider
)
select
  r.provider,
  count(*) filter (where true)                as runs_24h,
  max(r.ts)                                   as last_run_ts,
  sum(r.item_count)                            as items_ingested_24h,
  round(avg(r.dedupe_rate)::numeric, 2)        as dedupe_avg_pct_24h,
  coalesce(e.errors_24h, 0)                    as errors_24h,
  round(100.0 *
    (sum(case when r.success then 1 else 0 end)) /
    nullif(count(*),0), 1)                     as success_rate_pct_24h,
  max(r.ts) filter (where r.success)           as last_success_ts
from runs r
left join errs e on e.provider = r.provider
group by r.provider, e.errors_24h;