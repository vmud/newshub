-- Are we covering each brand in the last 24h?
create or replace view company_coverage_24h as
select
  c.canonical_name as company,
  count(a.id)      as items_24h,
  max(a.published_at) as last_item_ts,
  count(distinct a.source_domain) as distinct_sources
from companies c
left join articles a
  on a.company_id = c.id
 and a.published_at >= now() - interval '24 hours'
group by c.canonical_name
order by c.canonical_name;