-- Latency & cost for Snacks in the last 24h
create or replace view snacks_cost_24h as
select
  count(*)                                        as summaries_24h,
  round(sum(coalesce(cost_usd,0))::numeric, 4)    as total_cost_usd_24h,
  round(avg(coalesce(latency_ms,0))::numeric, 1)  as avg_latency_ms_24h,
  percentile_cont(0.95) within group (order by coalesce(latency_ms,0)) as p95_latency_ms_24h
from summaries
where created_at >= now() - interval '24 hours';